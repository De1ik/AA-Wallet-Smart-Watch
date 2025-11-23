Структура которая хранит количество установленных делегированныз ключей для каждого кошелька
mapping(address => uint256) public usedIds;

----------------------------------------------------------------------

структура хранит статус каждого полиси по конкретному полис Айди
mapping(bytes32 => mapping(address => Status)) public status;

{
  "policyId123": {
    "0xAAAA": "Live",
    "0xBBBB": "NA"
  },
  "policyIdXYZ": {
    "0xAAAA": "Deprecated"
  }
}

enum Status {
    NA, // не созданный
    Live, // активный
    Deprecated //удаленный
}

----------------------------------------------------------------------

mapping(bytes32 => mapping(address => mapping(bytes32 => StoredPermission))) private storedPermissions;

В человеческом виде:

“Для каждой политики (id) и для каждого пользователя (wallet)
храним список разрешённых действий по их уникальному хэшу (permissionHash).”

{
  "policyId123": {
    "0xWALLET": {
      "0xHASH1": {
        "valueLimit": 1,
        "dailyLimit": 10,
        "owner": "0xWALLET",
        "rules": [...]
      },
      "0xHASH2": {...}
    }
  }
}

policyId = keccak256(abi.encodePacked("CallPolicy", msg.sender, block.number))

permissionHash = keccak256(
    callType,
    targetAddress,
    functionSelector
)

struct StoredPermission {
    uint256 valueLimit;   // для не-asset вызовов (fallback)
    uint256 dailyLimit;   // для не-asset вызовов (fallback)
    ParamRule[] rules;
    address owner;     // кто установил ограничения
    bool exists;
}

storedPermissions[id][wallet][permissionHash] = StoredPermission {
    valueLimit = 1 ETH,
    dailyLimit = 10 ETH,
    rules = [],
    owner = wallet,
    exists = true
}


----------------------------------------------------------------------

выдает список першишин хешев для определенного кошельька
mapping(bytes32 => mapping(address => bytes32[])) private permissionHashesByOwner;

список всех permissions для UI

1. трансфер ETH  → hash A
2. трансфер USDC → hash B
3. вызов fallback → hash C

permissionHashesByOwner[id][wallet] = [A, B, C]


----------------------------------------------------------------------

хранит количество испоьльзыванных денег в день для делегированного ключа
mapping(bytes32 => mapping(address => mapping(bytes32 => mapping(uint256 => uint256)))) public dailyUsed;

dailyUsed[id][wallet][ETH][19877] = 3 ETH


----------------------------------------------------------------------

mapping(bytes32 => mapping(address => mapping(address => TokenLimit))) public tokenLimits;

[id][wallet][tokenAddress] -> TokenLimit

struct TokenLimit {
    bool enabled;       // токен вообще разрешён или нет
    uint256 txLimit;    // максимум за одну транзакцию
    uint256 dailyLimit; // максимум за сутки
}

Где tokenAddress:
address(0) = native ETH
0xTOKEN1 = USDC
0xTOKEN2 = USDT
0xTOKEN3 = твой кастомный токен

tokenLimits[id][wallet][ETH] = {
    enabled: true,
    txLimit: 1 ETH,
    dailyLimit: 5 ETH
}


----------------------------------------------------------------------

хранит количество испоьльзыванных денег в день для делегированного ключа
mapping(bytes32 => mapping(address => mapping(address => mapping(uint256 => uint256)))) public tokenDailyUsed;

Точно как dailyUsed, но для токенов.

tokenDailyUsed[id][wallet][USDC][19877] = 500

----------------------------------------------------------------------

хранит разрешенных получателей для делегированного ключа
mapping(bytes32 => mapping(address => mapping(address => bool))) public allowedRecipients;

[id][wallet][recipient] = true/false
allowedRecipients[id][wallet][0xFriend1] = true
allowedRecipients[id][wallet][0xGirlfriend] = true


----------------------------------------------------------------------
СОБЫТИЯ

параметр indexed позовляет искать по топику (участвуют в фильтрации)

indexed → можно использовать как фильтр (topics)
non-indexed → можно прочитать только ПОСЛЕ того как нашли событие

----------------------------------------------------------------------




CallPolicy Storage
|
|-- usedIds
|   └── walletA: 1
|
|-- status
|   └── policyId123:
|       ├── walletA: Live
|       └── walletB: NA
|
|-- storedPermissions
|   └── policyId123:
|       └── walletA:
|           ├── hashETH: Permission{...}
|           ├── hashUSDC: Permission{...}
|           └── hashCALL: Permission{...}
|
|-- tokenLimits
|   └── policyId123:
|       └── walletA:
|           ├── ETH: {enabled: true, txLimit: 1 ETH, daily: 5 ETH}
|           ├── USDC: {...}
|           └── USDT: {enabled: false}
|
|-- allowedRecipients
|   └── policyId123:
|       └── walletA:
|           ├── friend1: true
|           ├── girlfriend: true
|           └── randomUser: false
