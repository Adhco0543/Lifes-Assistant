import Foundation
import RoomPlan
import simd

struct RoomScanPayload: Codable {
    let version: Int
    let source: String
    let scanId: String
    let roomLengthInches: Double
    let roomWidthInches: Double
    let ceilingHeightInches: Double
    let items: [RoomScanItem]

    struct RoomScanItem: Codable {
        let id: String
        let label: String
        let category: String
        let xInches: Double
        let yInches: Double
        let widthInches: Double
        let depthInches: Double
        let heightInches: Double
        let source: String
    }

    static func make(from room: CapturedRoom) -> RoomScanPayload? {
        let measuredSurfaces = room.floors + room.walls
        let roomCorners = measuredSurfaces.flatMap { corners(transform: $0.transform, dimensions: $0.dimensions) }
        guard let bounds = horizontalBounds(of: roomCorners) else { return nil }

        let wallHeights = room.walls.map { Double($0.dimensions.y) }.filter { $0 > 0.5 && $0 < 8 }
        guard !wallHeights.isEmpty else { return nil }
        let sortedHeights = wallHeights.sorted()
        let heightMeters = sortedHeights[sortedHeights.count / 2]
        let lengthInches = metersToInches(bounds.maxX - bounds.minX)
        let widthInches = metersToInches(bounds.maxZ - bounds.minZ)
        let heightInches = metersToInches(heightMeters)
        guard (12...2400).contains(lengthInches), (12...2400).contains(widthInches), (24...240).contains(heightInches) else {
            return nil
        }

        let detectedItems = (room.objects.map { element(from: $0) } +
            room.doors.map { element(from: $0, label: "Door", category: "opening") } +
            room.windows.map { element(from: $0, label: "Window", category: "opening") } +
            room.openings.map { element(from: $0, label: "Opening", category: "opening") })
            .compactMap { element -> RoomScanItem? in
                guard let element,
                      let itemBounds = horizontalBounds(of: element.corners) else { return nil }
                let itemWidth = min(lengthInches, max(2, metersToInches(itemBounds.maxX - itemBounds.minX)))
                let itemDepth = min(widthInches, max(2, metersToInches(itemBounds.maxZ - itemBounds.minZ)))
                let x = min(lengthInches - itemWidth, max(0, metersToInches((itemBounds.minX + itemBounds.maxX) / 2 - bounds.minX) - itemWidth / 2))
                let y = min(widthInches - itemDepth, max(0, metersToInches((itemBounds.minZ + itemBounds.maxZ) / 2 - bounds.minZ) - itemDepth / 2))
                let itemHeight = min(240, max(2, metersToInches(element.heightMeters)))
                return RoomScanItem(
                    id: element.id,
                    label: element.label,
                    category: element.category,
                    xInches: rounded(x),
                    yInches: rounded(y),
                    widthInches: rounded(itemWidth),
                    depthInches: rounded(itemDepth),
                    heightInches: rounded(itemHeight),
                    source: "roomplan"
                )
            }
            .prefix(100)

        return RoomScanPayload(
            version: 1,
            source: "apple-roomplan",
            scanId: UUID().uuidString,
            roomLengthInches: rounded(lengthInches),
            roomWidthInches: rounded(widthInches),
            ceilingHeightInches: rounded(heightInches),
            items: Array(detectedItems)
        )
    }

    private struct Bounds {
        let minX: Double
        let maxX: Double
        let minZ: Double
        let maxZ: Double
    }

    private struct DetectedElement {
        let id: String
        let label: String
        let category: String
        let heightMeters: Double
        let corners: [SIMD3<Float>]
    }

    private static func element(from object: CapturedRoom.Object) -> DetectedElement? {
        let name = String(describing: object.category)
            .replacingOccurrences(of: "_", with: " ")
            .capitalized
        let categoryName = name.lowercased()
        let itemCategory: String
        if categoryName.contains("refrigerator") || categoryName.contains("stove") || categoryName.contains("washer") || categoryName.contains("oven") || categoryName.contains("dishwasher") {
            itemCategory = "appliance"
        } else if categoryName.contains("storage") || categoryName.contains("cabinet") {
            itemCategory = "cabinet"
        } else if categoryName.contains("sink") || categoryName.contains("toilet") || categoryName.contains("bathtub") || categoryName.contains("fireplace") {
            itemCategory = "fixture"
        } else if categoryName.contains("chair") || categoryName.contains("table") || categoryName.contains("sofa") || categoryName.contains("bed") || categoryName.contains("stool") || categoryName.contains("television") {
            itemCategory = "furniture"
        } else {
            itemCategory = "custom"
        }
        let points = corners(transform: object.transform, dimensions: object.dimensions)
        guard !points.isEmpty else { return nil }
        return DetectedElement(
            id: object.identifier.uuidString,
            label: name.isEmpty ? "Detected room item" : name,
            category: itemCategory,
            heightMeters: Double(object.dimensions.y),
            corners: points
        )
    }

    private static func element(from surface: CapturedRoom.Surface, label: String, category: String) -> DetectedElement? {
        let points = corners(transform: surface.transform, dimensions: surface.dimensions)
        guard !points.isEmpty else { return nil }
        return DetectedElement(
            id: surface.identifier.uuidString,
            label: label,
            category: category,
            heightMeters: Double(surface.dimensions.y),
            corners: points
        )
    }

    private static func corners(transform: simd_float4x4, dimensions: SIMD3<Float>) -> [SIMD3<Float>] {
        guard dimensions.x.isFinite, dimensions.y.isFinite, dimensions.z.isFinite,
              dimensions.x > 0, dimensions.y >= 0, dimensions.z > 0 else { return [] }
        return [-1.0, 1.0].flatMap { x in
            [-1.0, 1.0].flatMap { y in
                [-1.0, 1.0].map { z in
                    let local = SIMD4<Float>(x * dimensions.x / 2, y * dimensions.y / 2, z * dimensions.z / 2, 1)
                    let world = transform * local
                    return SIMD3<Float>(world.x, world.y, world.z)
                }
            }
        }
    }

    private static func horizontalBounds(of points: [SIMD3<Float>]) -> Bounds? {
        let valid = points.filter { $0.x.isFinite && $0.z.isFinite }
        guard let minX = valid.map({ Double($0.x) }).min(),
              let maxX = valid.map({ Double($0.x) }).max(),
              let minZ = valid.map({ Double($0.z) }).min(),
              let maxZ = valid.map({ Double($0.z) }).max(),
              maxX - minX > 0.25, maxZ - minZ > 0.25 else { return nil }
        return Bounds(minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ)
    }

    private static func metersToInches(_ meters: Double) -> Double {
        meters * 39.37007874
    }

    private static func rounded(_ value: Double) -> Double {
        (value * 100).rounded() / 100
    }
}
