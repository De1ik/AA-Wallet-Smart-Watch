import SwiftUI

//struct WalletHomeView: View {
//    @StateObject var session = WatchSessionManager.shared
//
//    var body: some View {
//        VStack(alignment: .leading, spacing: 8) {
//          Text("Wallet")
//              .font(.headline)
//              .padding(.bottom, 8)
//
//          Text("Balance: \(session.balance)")
//              .font(.body)
//
//          Text("Address: \(session.address)")
//              .font(.footnote)
//              .lineLimit(1)
//              .truncationMode(.middle)
//        
//          // Новая кнопка обновления
//          Button(action: {
//              session.requestAccountUpdateFromPhone()
//          }) {
//              Text("Refresh")
//                  .font(.subheadline)
//                  .padding(6)
//                  .frame(maxWidth: .infinity)
//          }
//          .background(Color.blue)
//          .foregroundColor(.white)
//          .cornerRadius(8)
//
//          // История транзакций
//          if !session.history.isEmpty {
//              Divider().padding(.vertical, 4)
//              Text("History:")
//                  .font(.subheadline)
//                  .padding(.bottom, 2)
//              // Исправлено: .enumerated() для id
//              List(Array(session.history.enumerated()), id: \.offset) { idx, tx in
//                  VStack(alignment: .leading, spacing: 2) {
//                      Text("TxID: \(tx["txid"] as? String ?? "-")")
//                          .font(.caption2)
//                          .lineLimit(1)
//                          .truncationMode(.middle)
//                      Text("Amount: \(tx["amount"] as? String ?? "-")")
//                          .font(.caption2)
//                      Text("Status: \(tx["status"] as? String ?? "-")")
//                          .font(.caption2)
//                  }
//              }
//              .listStyle(.carousel)
//              .frame(height: 70)
//          }
//      }
//      .padding(.horizontal)
//      .onAppear {
//          session.requestAccountUpdateFromPhone()
//      }
//    }
//}
