import Foundation

struct PendingUserOp {
    let kernelAddress: String
    let delegatedEOA: String
    let receiver: String
    let receiverLabel: String
    let displayAmount: String
    let amountInWei: String
    let tokenAddress: String?
    let tokenSymbol: String
    let response: PrepareUserOpResponse
}
