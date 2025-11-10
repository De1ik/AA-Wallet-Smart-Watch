import SwiftUI

struct KeyGeneratedView: View {
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
                
                VStack(spacing: 12) {
                // Top spacer to account for time display
                Spacer()
                    .frame(height: geometry.size.height * 0.03)
                
                VStack(spacing: 12) {
                    // Title
                    Text("New Address")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.white)
                    
                    // Address - Full display with wrapping
                    Text(session.generatedAddress)
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
                    
                    // Instruction - Compact text
                    Text("Compare with address in your mobile app")
                        .font(.system(size: 10))
                        .foregroundColor(.gray)
                        .multilineTextAlignment(.center)
                        .lineLimit(nil)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 8)
                }
                
                
                // Close Button - Smaller, modern style
                Button(action: {
                    session.closeKeyGeneratedView()
                }) {
                    Text("Close")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .frame(height: 36)
                        .background(
                            LinearGradient(
                                colors: [Color.red.opacity(0.9), Color.red.opacity(0.7)],
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
