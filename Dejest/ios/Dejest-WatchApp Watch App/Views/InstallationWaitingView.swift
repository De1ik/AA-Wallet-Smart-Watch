import SwiftUI

struct InstallationWaitingView: View {
    @ObservedObject var session = WatchSessionManager.shared

    var body: some View {
        GeometryReader { geometry in
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
                
                VStack(spacing: 0) {
                // Top spacer to account for time display
                Spacer()
                    .frame(height: geometry.size.height * 0.07)
                
                VStack(spacing: 12) {
                    // Compact header
                    Image(systemName: "hourglass")
                        .font(.system(size: 32))
                        .foregroundColor(.blue)
                    
                    Text("Please Wait")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.white)
                    
                    // Compact message
                    Text("Wait until installation on mobile completes before use.")
                            .font(.system(size: 12))
                            .foregroundColor(.gray)
                            .multilineTextAlignment(.center)
                            .lineLimit(nil)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.horizontal, 16)
                }
                
                Spacer()
                    .frame(height: 5)
                
                // Smaller modern button
                Button(action: {
                    session.closeInstallationWaitingView()
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
                .padding(.horizontal, 16)
                .buttonStyle(.plain)
                
                // Bottom spacer
                Spacer()
                    .frame(height: geometry.size.height * 0.08)
                }
            }
        }
    }
}

