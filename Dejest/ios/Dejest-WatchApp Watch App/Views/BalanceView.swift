//
//  BalanceView.swift
//  solanawallet
//
//  Created by idgest on 31/08/2025.
//

import SwiftUI
import WatchKit
import WatchConnectivity

struct BalanceView: View {
    @State private var accountState: AccountStateSnapshot?
    @State private var recentHistory: [TransactionDTO] = []
    @State private var isLoading: Bool = false
    @State private var errorMessage: String?
    @State private var address: String = ""
    @State private var showHistorySheet: Bool = false
    @State private var showCopyConfirmation: Bool = false
    @State private var showTokensSheet: Bool = false
    
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(hex: "0F0B2B").opacity(0.95),
                    Color(hex: "1B103C").opacity(0.85),
                    Color.black.opacity(0.9)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 16) {
                    accountHeader
                    balanceCard
                    tokenBalancesCard
                    historyCard
                    refreshButton
                }
                .padding(.horizontal)
                // .padding(.top, 2)
                .padding(.bottom)
            }
        }
        .sheet(isPresented: $showHistorySheet) {
            TransactionHistorySheet(transactions: recentHistory)
        }
        .sheet(isPresented: $showTokensSheet) {
            TokenBalancesSheet(tokens: accountState?.tokens ?? [])
        }
        .onAppear(perform: loadAccountState)
    }
    
    private var accountHeader: some View {
        VStack(spacing: 6) {
            Text("Main Account")
                .font(.caption)
                .foregroundColor(.gray)
            
            Button(action: copyMainAddress) {
                Text(address.isEmpty ? "No address" : address)
                    .font(.system(size: 9, design: .monospaced))
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)
                    .lineLimit(nil)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.white.opacity(0.1))
                    .cornerRadius(8)
            }
            .buttonStyle(.plain)
            .disabled(address.isEmpty)
            .accessibilityLabel("Copy main account address")
            
            if showCopyConfirmation {
                Text("Copied to clipboard")
                    .font(.caption2)
                    .foregroundColor(.green.opacity(0.8))
            }
        }
    }
    
    private var balanceCard: some View {
        VStack(spacing: 8) {
            Text("Account Balance")
                .font(.headline)
                .foregroundColor(.white.opacity(0.85))
            
            if isLoading {
                ProgressView()
                    .progressViewStyle(.circular)
            } else if let errorMessage = errorMessage {
                Text("❌ \(errorMessage)")
                    .foregroundColor(.red)
                    .font(.caption)
                    .multilineTextAlignment(.center)
            } else if let balance = accountState?.ethBalance {
                Text("\(formattedBalance(balance)) ETH")
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
            } else {
                Text("Balance unavailable")
                    .font(.caption)
                    .foregroundColor(.gray)
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.white.opacity(0.08))
        )
    }
    
    private func copyMainAddress() {
        guard !address.isEmpty else { return }
        
        let message: [String: Any] = [
            "type": "COPY_TO_CLIPBOARD",
            "text": address
        ]
        
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(message, replyHandler: nil) { error in
                print("Error copying address via phone: \(error.localizedDescription)")
            }
        } else {
            print("iPhone not reachable to copy address.")
        }
        
        WKInterfaceDevice.current().play(.click)
        withAnimation {
            showCopyConfirmation = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            withAnimation {
                showCopyConfirmation = false
            }
        }
    }
    
    private var tokenBalancesCard: some View {
        Group {
            if let tokens = accountState?.tokens, !tokens.isEmpty {
                let sortedTokens = tokens.sorted {
                    (tokenAmountValue($0) ?? 0) > (tokenAmountValue($1) ?? 0)
                }
                let topTokens = Array(sortedTokens.prefix(3))
                
                Button {
                    showTokensSheet = true
                } label: {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Tokens")
                                .font(.caption)
                                .foregroundColor(.gray)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption2)
                                .foregroundColor(.gray)
                        }
                        
                        ForEach(Array(topTokens.enumerated()), id: \.offset) { pair in
                            let token = pair.element
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(token.name)
                                        .font(.headline)
                                        .foregroundColor(.white)
                                        .lineLimit(1)
                                    Text(token.symbol)
                                        .font(.caption2)
                                        .foregroundColor(.gray)
                                }
                                
                                Spacer()
                                
                                VStack(alignment: .trailing, spacing: 2) {
                                    Text("\(formattedTokenAmount(token)) \(token.symbol)")
                                        .font(.body)
                                        .foregroundColor(.white)
                                    if let value = token.value, value > 0 {
                                        Text("$\(String(format: "%.2f", value))")
                                            .font(.caption2)
                                            .foregroundColor(.gray)
                                    }
                                }
                            }
                            .padding(10)
                            .background(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(Color.white.opacity(0.05))
                            )
                        }
                        
                        Text("Tap to view all tokens")
                            .font(.caption2)
                            .foregroundColor(.gray)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .fill(Color.white.opacity(0.04))
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }
    
    private var historyCard: some View {
        Group {
            if recentHistory.isEmpty {
                VStack(spacing: 6) {
                    Text("Activity")
                        .font(.caption)
                        .foregroundColor(.gray)
                    Text("No recent transactions")
                        .font(.caption2)
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(Color.white.opacity(0.1), lineWidth: 1)
                )
            } else if let latest = recentHistory.first {
                Button {
                    showHistorySheet = true
                } label: {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Latest Activity")
                                .font(.caption)
                                .foregroundColor(.gray)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption2)
                                .foregroundColor(.gray)
                        }
                        
                        HStack(alignment: .top, spacing: 8) {
                            transactionIcon(for: latest)
                                .font(.headline)
                                .foregroundColor(.white)
                                .padding(6)
                                .background(
                                    Circle()
                                        .fill(Color.white.opacity(0.1))
                                )
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text(transactionHeadline(latest))
                                    .font(.body)
                                    .foregroundColor(.white)
                                Text(transactionSubline(latest))
                                    .font(.caption2)
                                    .foregroundColor(.gray)
                            }
                        }
                        
                    Text("Tap to view last 5 transactions")
                        .font(.caption2)
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .fill(Color.white.opacity(0.06))
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }
    
    private var refreshButton: some View {
        Button(action: loadAccountState) {
            Group {
                if isLoading {
                    ProgressView()
                        .tint(.white)
                } else {
                    Text("Refresh")
                        .font(.headline)
                        .foregroundColor(.white)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .background(
                LinearGradient(
                    colors: [
                        Color(hex: "8B5CF6").opacity(0.9),
                        Color(hex: "8B5CF6").opacity(0.7)
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .cornerRadius(22)
        }
        .buttonStyle(.plain)
        .disabled(isLoading || address.isEmpty)
    }
    
    private func loadAccountState() {
        guard !isLoading else { return }
        
        let resolvedAddress = resolveMainAddress()
        address = resolvedAddress
        
        guard !resolvedAddress.isEmpty else {
            errorMessage = "Main wallet address is missing."
            return
        }
        
        isLoading = true
        errorMessage = nil
        
        AccountStateService.shared.fetchAccountState(for: resolvedAddress) { result in
            DispatchQueue.main.async {
                self.isLoading = false
                
                switch result {
                case .success(let snapshot):
                    self.accountState = snapshot
                    self.recentHistory = Array(snapshot.history.prefix(5))
                case .failure(let error):
                    self.errorMessage = error.localizedDescription
                }
            }
        }
    }
    
    private func resolveMainAddress() -> String {
        EthereumKeyManager.shared.loadKernelAddress() ?? ""
    }
    
    private func formattedBalance(_ raw: String) -> String {
        guard let value = Double(raw) else { return raw }
        if value >= 1 {
            return String(format: "%.3f", value)
        }
        return String(format: "%.6f", value)
    }
    
    private func formattedTokenAmount(_ token: TokenBalanceDTO) -> String {
        guard let value = tokenAmountValue(token) else {
            return token.amount ?? token.balance ?? "0"
        }
        
        if value >= 1 {
            return String(format: "%.2f", value)
        } else if value >= 0.01 {
            return String(format: "%.3f", value)
        } else {
            return String(format: "%.4f", value)
        }
    }
    
    private func tokenAmountValue(_ token: TokenBalanceDTO) -> Double? {
        if let amount = token.amount, let value = Double(amount) {
            return value
        }
        if let balance = token.balance, let value = Double(balance) {
            return value
        }
        return nil
    }
    
    private func transactionHeadline(_ transaction: TransactionDTO) -> String {
        let direction = transaction.directionDisplay
        let symbol = transaction.tokenSymbol ?? "ETH"
        return "\(direction) \(transaction.value) \(symbol)"
    }
    
    private func transactionSubline(_ transaction: TransactionDTO) -> String {
        let counterparty = transaction.isSent ? transaction.to : transaction.from
        var parts: [String] = []
        if let counterparty = counterparty {
            parts.append(shortAddress(counterparty))
        }
        if transaction.timestamp > 0 {
            let date = Date(timeIntervalSince1970: transaction.timestamp)
            parts.append(shortDateTimeFormatter.string(from: date))
        }
        parts.append(transaction.statusDisplay)
        return parts.joined(separator: " • ")
    }
    
    private func transactionIcon(for transaction: TransactionDTO) -> Image {
        return transaction.isSent ? Image(systemName: "arrow.up.right") : Image(systemName: "arrow.down.left")
    }
    
    private var shortDateTimeFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter
    }
    
    private func shortAddress(_ address: String) -> String {
        guard address.count > 10 else { return address }
        let prefix = address.prefix(6)
        let suffix = address.suffix(4)
        return "\(prefix)…\(suffix)"
    }
}

struct TransactionHistorySheet: View {
    let transactions: [TransactionDTO]
    
    var body: some View {
        NavigationView {
            List {
                if transactions.isEmpty {
                    Text("No recent transactions.")
                        .foregroundColor(.gray)
                } else {
                    ForEach(transactions) { tx in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(historyDirection(tx))
                                    .font(.headline)
                                Spacer()
                                Text(historyStatus(tx))
                                    .font(.caption)
                                    .foregroundColor(.gray)
                            }
                            Text("\(tx.value) \(tx.tokenSymbol ?? "ETH")")
                                .font(.title3)
                            
                            if let counterparty = historyCounterparty(tx) {
                                Text(counterparty)
                                    .font(.caption)
                                    .foregroundColor(.gray)
                            }
                            
                            if tx.timestamp > 0 {
                                Text(historyDate(tx))
                                    .font(.caption2)
                                    .foregroundColor(.gray)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .navigationTitle("Recent History")
        }
    }
    
    private func historyDirection(_ tx: TransactionDTO) -> String {
        tx.directionDisplay
    }
    
    private func historyStatus(_ tx: TransactionDTO) -> String {
        tx.statusDisplay
    }
    
    private func historyCounterparty(_ tx: TransactionDTO) -> String? {
        if tx.isSent, let to = tx.to {
            return "To: \(shortAddress(to))"
        } else if let from = tx.from {
            return "From: \(shortAddress(from))"
        }
        return nil
    }
    
    private func historyDate(_ tx: TransactionDTO) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: Date(timeIntervalSince1970: tx.timestamp))
    }
    
    private func shortAddress(_ address: String) -> String {
        guard address.count > 10 else { return address }
        let prefix = address.prefix(6)
        let suffix = address.suffix(4)
        return "\(prefix)…\(suffix)"
    }
}

struct TokenBalancesSheet: View {
    let tokens: [TokenBalanceDTO]
    
    var body: some View {
        NavigationView {
            List {
                if tokens.isEmpty {
                    Text("No tokens to display.")
                        .foregroundColor(.gray)
                } else {
                    ForEach(sortedTokens.indices, id: \.self) { index in
                        let token = sortedTokens[index]
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(token.name)
                                    .font(.headline)
                                Spacer()
                                Text(token.symbol)
                                    .font(.caption)
                                    .foregroundColor(.gray)
                            }
                            Text("\(formattedTokenAmount(token)) \(token.symbol)")
                                .font(.title3)
                            
                            if let value = token.value, value > 0 {
                                Text("$\(String(format: "%.2f", value))")
                                    .font(.caption)
                                    .foregroundColor(.gray)
                            }
                            
                            if let address = token.address {
                                Text(address)
                                    .font(.caption2)
                                    .foregroundColor(.gray)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .navigationTitle("Token Balances")
        }
    }
    
    private var sortedTokens: [TokenBalanceDTO] {
        tokens.sorted {
            (tokenAmountValue($0) ?? 0) > (tokenAmountValue($1) ?? 0)
        }
    }
    
    private func formattedTokenAmount(_ token: TokenBalanceDTO) -> String {
        guard let value = tokenAmountValue(token) else {
            return token.amount ?? token.balance ?? "0"
        }
        
        if value >= 1 {
            return String(format: "%.2f", value)
        } else if value >= 0.01 {
            return String(format: "%.3f", value)
        } else {
            return String(format: "%.4f", value)
        }
    }
    
    private func tokenAmountValue(_ token: TokenBalanceDTO) -> Double? {
        if let amount = token.amount, let value = Double(amount) {
            return value
        }
        if let balance = token.balance, let value = Double(balance) {
            return value
        }
        return nil
    }
}
