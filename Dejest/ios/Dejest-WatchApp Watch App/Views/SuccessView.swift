import SwiftUI
import WatchKit
import WatchConnectivity

struct SuccessView: View {
    @ObservedObject var session = WatchSessionManager.shared
    
    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                colors: [
                    Color(hex: "8B5CF6").opacity(0.3),
                    Color(hex: "8B5CF6").opacity(0.15),
                    Color.black.opacity(1.0)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            VStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .resizable()
                .scaledToFit()
                .frame(width: 70, height: 70)
                .foregroundColor(.green)
            
            if let hash = session.txHash {
                VStack(spacing: 2) {
                    Text("Tx Hash")
                        .font(.caption2)
                        .foregroundColor(.gray)
                    
                    Button(action: {
                        copyToClipboard(text: hash)
                    }) {
                        VStack(spacing: 4) {
                            Text(hash)
                                .font(.system(size: 9, design: .monospaced))
                                .foregroundColor(.white)
                                .lineLimit(nil)
                                .multilineTextAlignment(.center)
                                .fixedSize(horizontal: false, vertical: true)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(Color.gray.opacity(0.15))
                                .cornerRadius(8)
                                .padding(.horizontal, 8)
                            
                            Text("Tap to copy")
                                .font(.caption2)
                                .foregroundColor(.gray.opacity(0.8))
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            
            Button(action: {
                session.closeSuccessView(redirectTo: .home)
            }) {
                Text("Close")
                    .font(.system(size: 14, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .frame(height: 36)
                    .background(
                        LinearGradient(
                            colors: [Color(hex: "8B5CF6").opacity(0.7), Color(hex: "8B5CF6").opacity(0.5)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .foregroundColor(.white)
                    .cornerRadius(18)
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 16)
            }
        }
    }
    
    private func copyToClipboard(text: String) {
        // In watchOS, we need to send the data to iPhone to copy
        // Using WatchConnectivity to send copy request to iPhone
        let message = [
            "type": "COPY_TO_CLIPBOARD",
            "text": text
        ]
        
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(message as [String : Any], replyHandler: nil, errorHandler: { error in
                print("Error sending copy request: \(error.localizedDescription)")
            })
        } else {
            print("iPhone not reachable for clipboard copy")
        }
        
        // Haptic feedback
        WKInterfaceDevice.current().play(.click)
        
        print("Transaction hash copy requested")
    }
}
