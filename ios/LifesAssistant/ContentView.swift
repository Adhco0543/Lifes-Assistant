import SwiftUI
import WebKit
import UIKit

@MainActor
final class WorkspaceBridge: ObservableObject {
    @Published var isShowingRoomScanner = false
    weak var webView: WKWebView?

    func importScan(_ payload: RoomScanPayload) {
        guard let webView,
              let data = try? JSONEncoder().encode(payload) else { return }
        let base64 = data.base64EncodedString()
        let script = """
        (() => {
          const bytes = Uint8Array.from(atob('\(base64)'), (character) => character.charCodeAt(0));
          const detail = JSON.parse(new TextDecoder().decode(bytes));
          window.dispatchEvent(new CustomEvent('lifeassistant:room-scan', { detail }));
        })();
        """
        webView.evaluateJavaScript(script)
    }
}

struct ContentView: View {
    @StateObject private var bridge = WorkspaceBridge()
    @AppStorage("lifeAssistantWorkspaceURL") private var workspaceURL = ""
    @State private var urlDraft = ""

    private var validWorkspaceURL: URL? {
        guard let url = URL(string: workspaceURL),
              url.scheme == "https",
              let host = url.host?.lowercased(),
              isLifeAssistantHost(host) else { return nil }
        return url
    }

    private func isLifeAssistantHost(_ host: String) -> Bool {
        host == "lifes-assistant.vercel.app" || host.hasSuffix("-adhco0543s-projects.vercel.app")
    }

    private var draftCanOpen: Bool {
        guard let url = URL(string: urlDraft.trimmingCharacters(in: .whitespacesAndNewlines)),
              url.scheme == "https",
              let host = url.host?.lowercased() else { return false }
        return isLifeAssistantHost(host)
    }

    var body: some View {
        Group {
            if let url = validWorkspaceURL {
                VStack(spacing: 0) {
                    HStack(spacing: 8) {
                        Image(systemName: "viewfinder.circle.fill")
                            .foregroundStyle(Color(red: 0.45, green: 0.86, blue: 0.68))
                        Text("Life’s Assistant · RoomPlan")
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                        Spacer()
                        Button("Change link") {
                            urlDraft = workspaceURL
                            workspaceURL = ""
                        }
                        .font(.system(size: 12, weight: .medium))
                    }
                    .padding(.horizontal, 16)
                    .frame(height: 42)
                    .background(Color(red: 0.08, green: 0.10, blue: 0.11))

                    WorkspaceWebView(url: url, bridge: bridge)
                }
            } else {
                connectionSetup
            }
        }
        .preferredColorScheme(.dark)
        .tint(Color(red: 0.34, green: 0.78, blue: 0.59))
        .sheet(isPresented: $bridge.isShowingRoomScanner) {
            RoomScannerView { result in
                bridge.importScan(result)
            }
            .interactiveDismissDisabled()
        }
    }

    private var connectionSetup: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.07, green: 0.09, blue: 0.11), Color(red: 0.12, green: 0.16, blue: 0.18)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 18) {
                Image(systemName: "viewfinder.circle.fill")
                    .font(.system(size: 42, weight: .light))
                    .foregroundStyle(Color(red: 0.45, green: 0.86, blue: 0.68))
                Text("Life’s Assistant")
                    .font(.system(size: 32, weight: .semibold, design: .rounded))
                    .tracking(-1)
                Text("Connect the workspace, then scan a room with the LiDAR camera on a supported iPhone or iPad.")
                    .font(.system(size: 16))
                    .foregroundStyle(.white.opacity(0.68))
                    .fixedSize(horizontal: false, vertical: true)

                VStack(alignment: .leading, spacing: 8) {
                    Text("WORKSPACE LINK")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .tracking(1.2)
                        .foregroundStyle(.white.opacity(0.55))
                    TextField("Paste the current review URL", text: $urlDraft)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                        .autocorrectionDisabled()
                        .padding(13)
                        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(.white.opacity(0.12)))
                }
                .padding(.top, 8)

                Button {
                    guard let url = URL(string: urlDraft.trimmingCharacters(in: .whitespacesAndNewlines)),
                          url.scheme == "https",
                          let host = url.host?.lowercased(),
                          isLifeAssistantHost(host) else { return }
                    workspaceURL = url.absoluteString
                } label: {
                    HStack {
                        Text("Open workspace")
                        Spacer()
                        Image(systemName: "arrow.up.right")
                    }
                    .font(.system(size: 15, weight: .semibold))
                    .padding(.horizontal, 16)
                    .frame(height: 50)
                    .foregroundStyle(Color(red: 0.05, green: 0.1, blue: 0.08))
                    .background(Color(red: 0.45, green: 0.86, blue: 0.68), in: RoundedRectangle(cornerRadius: 13))
                }
                .disabled(!draftCanOpen)

                Text("Paste the current branch preview link to test native room scanning. For a protected Vercel preview, use the full share link. The address is saved only on this device.")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.5))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(26)
            .frame(maxWidth: 520, alignment: .leading)
        }
    }
}

struct WorkspaceWebView: UIViewRepresentable {
    let url: URL
    @ObservedObject var bridge: WorkspaceBridge

    func makeCoordinator() -> Coordinator {
        Coordinator(bridge: bridge)
    }

    func makeUIView(context: Context) -> WKWebView {
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "roomScanner")
        let configuration = WKWebViewConfiguration()
        configuration.userContentController = controller
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.backgroundColor = UIColor(red: 0.09, green: 0.09, blue: 0.09, alpha: 1)
        webView.isOpaque = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        bridge.webView = webView
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.bridge = bridge
        guard webView.url?.absoluteString != url.absoluteString else { return }
        webView.load(URLRequest(url: url))
    }

    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandler {
        var bridge: WorkspaceBridge

        init(bridge: WorkspaceBridge) { self.bridge = bridge }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            let host = message.frameInfo.securityOrigin.host.lowercased()
            let isWorkspaceHost = host == "lifes-assistant.vercel.app" || host.hasSuffix("-adhco0543s-projects.vercel.app")
            guard message.name == "roomScanner", message.body as? String == "start", isWorkspaceHost else { return }
            bridge.isShowingRoomScanner = true
        }
    }
}
