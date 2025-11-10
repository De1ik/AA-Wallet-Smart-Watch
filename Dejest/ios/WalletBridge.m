//
//  WalletBridge.m
//  Dejest
//
//  Created by idgest on 22/09/2025.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(WalletBridge, RCTEventEmitter)
RCT_EXTERN_METHOD(sendToWatch:(NSDictionary)payload)
RCT_EXTERN_METHOD(resolveAccountData:(NSString)requestId data:(NSDictionary)data)
RCT_EXTERN_METHOD(pingWatch:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(generateKeyPair:(NSDictionary)data
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(syncPermissionData:(NSDictionary)data resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getAccountData:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end
