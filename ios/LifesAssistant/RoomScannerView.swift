import RoomPlan
import SwiftUI

@MainActor
final class RoomCaptureController: NSObject, ObservableObject, @preconcurrency RoomCaptureViewDelegate {
    @Published private(set) var isCapturing = false
    @Published private(set) var isProcessing = false
    @Published private(set) var result: RoomScanPayload?
    @Published var errorMessage: String?

    private weak var captureView: RoomCaptureView?

    override init() {
        super.init()
    }

    required init?(coder: NSCoder) {
        super.init()
    }

    func encode(with coder: NSCoder) { }

    func attach(_ view: RoomCaptureView) {
        captureView = view
        view.delegate = self
    }

    func start() {
        guard RoomCaptureSession.isSupported else {
            errorMessage = "Room scanning requires an iPhone or iPad with LiDAR. You can still enter dimensions manually in Spatial Workspace."
            return
        }
        result = nil
        errorMessage = nil
        isProcessing = false
        captureView?.captureSession.run(configuration: RoomCaptureSession.Configuration())
        isCapturing = true
    }

    func finish() {
        guard isCapturing else { return }
        isCapturing = false
        isProcessing = true
        captureView?.captureSession.stop()
    }

    func captureView(shouldPresent roomDataForProcessing: CapturedRoomData, error: Error?) -> Bool {
        if let error {
            errorMessage = "Room scan could not be processed: \(error.localizedDescription)"
            isCapturing = false
            isProcessing = false
            return false
        }
        return true
    }

    func captureView(didPresent processedResult: CapturedRoom, error: Error?) {
        isCapturing = false
        isProcessing = false
        if let error {
            errorMessage = "Room scan could not be processed: \(error.localizedDescription)"
            return
        }
        guard let payload = RoomScanPayload.make(from: processedResult) else {
            errorMessage = "The scan did not capture enough wall and floor detail to calculate room dimensions. Scan again slowly and include each corner."
            return
        }
        result = payload
    }
}

struct RoomCaptureRepresentable: UIViewRepresentable {
    @ObservedObject var controller: RoomCaptureController

    func makeCoordinator() -> RoomCaptureController { controller }

    func makeUIView(context: Context) -> RoomCaptureView {
        let view = RoomCaptureView(frame: .zero)
        controller.attach(view)
        return view
    }

    func updateUIView(_ view: RoomCaptureView, context: Context) {
        controller.attach(view)
    }
}

struct RoomScannerView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var controller = RoomCaptureController()
    let onImport: (RoomScanPayload) -> Void

    var body: some View {
        NavigationStack {
            Group {
                if RoomCaptureSession.isSupported {
                    scannerContent
                } else {
                    unsupportedContent
                }
            }
            .background(.black)
            .preferredColorScheme(.dark)
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    private var scannerContent: some View {
        ZStack(alignment: .top) {
                RoomCaptureRepresentable(controller: controller)
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    VStack(alignment: .leading, spacing: 7) {
                        Text(controller.result == nil ? "Scan the whole room" : "Review your scan")
                            .font(.headline)
                        Text(instructions)
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.8))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .background(.black.opacity(0.7), in: RoundedRectangle(cornerRadius: 16))
                    .padding(.horizontal, 16)
                    .padding(.top, 12)

                    Spacer()

                    if let result = controller.result {
                        scanSummary(result)
                    }

                    if let errorMessage = controller.errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.white)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(.red.opacity(0.78), in: RoundedRectangle(cornerRadius: 12))
                            .padding(.horizontal, 16)
                            .padding(.bottom, 8)
                    }

                    HStack(spacing: 12) {
                        Button("Cancel", role: .cancel) { dismiss() }
                            .buttonStyle(.bordered)
                            .tint(.white)

                        if controller.result != nil {
                            Button("Scan again") { controller.start() }
                                .buttonStyle(.bordered)
                                .tint(.white)
                            Button("Use this scan") {
                                if let result = controller.result { onImport(result) }
                                dismiss()
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color(red: 0.24, green: 0.78, blue: 0.56))
                        } else {
                            Button(controller.isProcessing ? "Preparing scan…" : controller.isCapturing ? "Finish scan" : "Start scan") {
                                if controller.isCapturing { controller.finish() }
                                else if !controller.isProcessing { controller.start() }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color(red: 0.24, green: 0.78, blue: 0.56))
                            .disabled(controller.isProcessing)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(16)
                    .background(.black.opacity(0.78))
                }
            }
            .onAppear { controller.start() }
            .onDisappear { controller.finish() }
    }

    private var unsupportedContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            Image(systemName: "lidar")
                .font(.system(size: 38, weight: .light))
                .foregroundStyle(Color(red: 0.45, green: 0.86, blue: 0.68))
            Text("Room scanning needs LiDAR")
                .font(.system(size: 26, weight: .semibold, design: .rounded))
            Text("Use a LiDAR-equipped iPhone or iPad to scan a room and capture its dimensions. This device can still use manual measurements in the workspace.")
                .font(.body)
                .foregroundStyle(.white.opacity(0.68))
            Button("Back to workspace") { dismiss() }
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.24, green: 0.78, blue: 0.56))
        }
        .padding(28)
        .frame(maxWidth: 520, maxHeight: .infinity, alignment: .leading)
        .foregroundStyle(.white)
        .background(Color(red: 0.07, green: 0.09, blue: 0.11).ignoresSafeArea())
    }

    private var instructions: String {
        if controller.result != nil {
            return "Check the room outline and detected items. RoomPlan measurements are estimates; verify critical dimensions before ordering materials."
        }
        return "Move slowly around the room. Keep the walls, corners, doors, and windows in view, then tap Finish scan."
    }

    private func scanSummary(_ result: RoomScanPayload) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                summaryValue("Length", inches: result.roomLengthInches)
                summaryValue("Width", inches: result.roomWidthInches)
                summaryValue("Ceiling", inches: result.ceilingHeightInches)
            }
            Text("\(result.items.count) detected item\(result.items.count == 1 ? "" : "s") · estimates can vary by room conditions")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.75))
        }
        .padding(14)
        .background(.black.opacity(0.76), in: RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal, 16)
        .padding(.bottom, 10)
    }

    private func summaryValue(_ label: String, inches: Double) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label.uppercased())
                .font(.system(size: 9, weight: .bold, design: .rounded))
                .foregroundStyle(.white.opacity(0.65))
            Text(formatInches(inches))
                .font(.system(size: 15, weight: .semibold, design: .rounded))
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func formatInches(_ value: Double) -> String {
        let feet = Int(value / 12)
        let inches = Int((value - Double(feet * 12)).rounded())
        return "\(feet)' \(inches)\""
    }
}
