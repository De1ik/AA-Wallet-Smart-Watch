import SwiftUI

struct TransactionConfirmView: View {
    @ObservedObject private var session = WatchSessionManager.shared
    @State private var errorMessage: String = ""
    
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: "1a092e"), Color(hex: "09040f")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            if let pending = session.pendingTransaction {
                ScrollView {
                    confirmationCard(for: pending)
                }
                .padding(.horizontal, 8)
            } else {
                VStack(spacing: 8) {
                    Text("No transaction data")
                        .font(.footnote)
                        .foregroundColor(.gray)
                    Button("Back to Wallet") {
                        session.dismissPendingTransaction()
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .navigationBarHidden(true)
    }
    
    @ViewBuilder
    private func confirmationCard(for pending: PendingUserOp) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Confirm Transfer")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.white)
                Text("Review and approve the data below")
                    .font(.system(size: 12))
                    .foregroundColor(.white.opacity(0.6))
            }
            .padding(.bottom, 6)
            
            summaryRow(pending: pending)
            infoCard(title: "Receiver", value: receiverDescription(for: pending), icon: "person", isAddress: true)
            infoCard(title: "Token", value: pending.tokenSymbol, icon: "cube")
            infoCard(title: "Amount", value: "\(formattedAmount(pending.displayAmount)) \(pending.tokenSymbol)", icon: "creditcard")
            
            if let permission = pending.response.echo?.permissionId {
                infoCard(title: "Permission ID", value: shortAddress(permission), icon: "lock")
            }
            
            if !errorMessage.isEmpty {
                errorBanner(message: errorMessage)
            }
            
            if session.isProcessingPendingTransaction {
                ProgressView("Signing & sending...")
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.top, 4)
            } else {
                actionButtons(for: pending)
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(Color.black.opacity(0.55))
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        )
    }
    
    private func summaryRow(pending: PendingUserOp) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                ZStack {
                    Circle()
                        .fill(Color(hex: "8b5bf6"))
                        .frame(width: 40, height: 40)
                    Image(systemName: "arrow.left.arrow.right")
                        .foregroundColor(.white)
                        .font(.system(size: 16, weight: .semibold))
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("Sending")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.white.opacity(0.6))
                    Text("\(formattedAmount(pending.displayAmount)) \(pending.tokenSymbol)")
                        .font(.system(size: 18, weight: .semibold, design: .rounded))
                        .foregroundColor(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }
                Spacer()
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text("Destination address")
                    .font(.system(size: 10))
                    .foregroundColor(.white.opacity(0.6))
                Text(pending.receiver)
                    .font(.system(size: 13, weight: .semibold, design: .monospaced))
                    .foregroundColor(.white)
                    .lineLimit(3)
                    .minimumScaleFactor(0.7)
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(Color.white.opacity(0.05))
        )
    }
    
    private func actionButtons(for pending: PendingUserOp) -> some View {
        VStack(spacing: 8) {
            Button(action: {
                confirmTransaction(pending)
            }) {
                Text("Approve & Send")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(
                        LinearGradient(
                            colors: [Color(hex: "39b981"), Color(hex: "2ca06c")],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .cornerRadius(18)
                    .shadow(color: Color(hex: "39b981").opacity(0.4), radius: 6, x: 0, y: 3)
            }
            .buttonStyle(.plain)
            
            Button(action: {
                session.dismissPendingTransaction()
            }) {
                Text("Cancel")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 36)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.white.opacity(0.2), lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
        }
    }
    
    private func errorBanner(message: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: "exclamationmark.octagon.fill")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(Color(hex: "EF4444"))
                Text("Action required")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.9))
            }
            Text(message)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.white)
                .multilineTextAlignment(.leading)
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.white.opacity(0.08))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color(hex: "EF4444").opacity(0.6), lineWidth: 1)
        )
    }
    
    private func infoCard(title: String, value: String, icon: String, isAddress: Bool = false) -> some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.white.opacity(0.07))
                    .frame(width: 32, height: 32)
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title.uppercased())
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(.white.opacity(0.55))
                if isAddress {
                    let parts = value.split(separator: "\n", maxSplits: 1, omittingEmptySubsequences: false)
                    if let name = parts.first, !name.isEmpty {
                        Text(name)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(.white)
                    }
                    if let address = parts.last {
                        Text(address)
                            .font(.system(size: 12, weight: .medium, design: .monospaced))
                            .foregroundColor(.white.opacity(0.9))
                            .lineLimit(nil)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                } else {
                    Text(value)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.white)
                        .lineLimit(2)
                }
            }
            Spacer()
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.white.opacity(0.04))
        )
    }
    
    private func receiverDescription(for pending: PendingUserOp) -> String {
        if pending.receiverLabel.isEmpty {
            return pending.receiver
        }
        return "\(pending.receiverLabel)\n\(pending.receiver)"
    }
    
    private func confirmTransaction(_ pending: PendingUserOp) {
        errorMessage = ""
        session.isProcessingPendingTransaction = true
        
        guard verifyServerPayloadMatchesRequest(for: pending) else {
            session.isProcessingPendingTransaction = false
            return
        }
        
        UserOpManager.shared.signUserOpHash(userOpHash: pending.response.userOpHash) { signResult in
            DispatchQueue.main.async {
                switch signResult {
                case .success(let signatureHex):
                    self.broadcastTransaction(pending: pending, signature: signatureHex)
                case .failure(let error):
                    self.session.isProcessingPendingTransaction = false
                    self.errorMessage = error.localizedDescription
                }
            }
        }
    }
    
    private func verifyServerPayloadMatchesRequest(for pending: PendingUserOp) -> Bool {
        guard let echo = pending.response.echo else {
            errorMessage = "Server response missing transaction echo data"
            return false
        }
        
        if echo.to.lowercased() != pending.receiver.lowercased() {
            errorMessage = "Destination address mismatch. Please restart the transaction."
            return false
        }
        
        if echo.amountWei != pending.amountInWei {
            errorMessage = "Amount mismatch. Please restart the transaction."
            return false
        }
        
        let originalToken = pending.tokenAddress?.lowercased() ?? "eth"
        let serverToken = echo.tokenAddress?.lowercased() ?? "eth"
        if originalToken != serverToken {
            errorMessage = "Token mismatch. Please restart the transaction."
            return false
        }
        
        // Placeholder for future hash recalculation / deeper validation
        // validateUserOperationHashMatchesPayload(pending)
        
        return true
    }
    
    private func broadcastTransaction(pending: PendingUserOp, signature: String) {
        UserOpManager.shared.sendSignedUserOp(
            kernelAddress: pending.kernelAddress,
            from: pending.delegatedEOA,
            to: pending.receiver,
            amountInWei: pending.amountInWei,
            tokenAddress: pending.tokenAddress,
            userOpHash: pending.response.userOpHash,
            signature: signature
        ) { result in
            DispatchQueue.main.async {
                self.session.isProcessingPendingTransaction = false
                switch result {
                case .success(let hash):
                    self.session.dismissPendingTransaction()
                    self.session.handleTxSuccess(hash: hash)
                case .failure(let error):
                    self.errorMessage = error.localizedDescription
                }
            }
        }
    }
    
    private func shortAddress(_ address: String) -> String {
        guard address.count > 10 else { return address }
        let prefix = address.prefix(6)
        let suffix = address.suffix(4)
        return "\(prefix)...\(suffix)"
    }
    
    private func formattedAmount(_ amount: String) -> String {
        if let decimal = Decimal(string: amount) {
            var value = decimal
            var rounded = Decimal()
            NSDecimalRound(&rounded, &value, 6, .plain)
            return NSDecimalNumber(decimal: rounded).stringValue
        }
        return amount
    }
    
    // Placeholder for future server payload hash validation (recalculation)
    private func validateUserOperationHashMatchesPayload(_ pending: PendingUserOp) -> Bool {
        // TODO: Recompute operation hash locally and compare with pending.response.userOpHash
        return true
    }
}
