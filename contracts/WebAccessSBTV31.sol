// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";

contract WebAccessSBTV3 is
    ERC721Upgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using CountersUpgradeable for CountersUpgradeable.Counter;

    /* --------------------------------------------------------------------- */
    /*                                Storage                                */
    /* --------------------------------------------------------------------- */

    struct SBTType {
        string   uri;        // GitHub‑raw (or IPFS) metadata
        bool     burnable;   // Allow user burn?
        bool     active;     // Claimable?
        uint256  maxSupply;  // Hard cap
        uint256  minted;     // # already minted
    }

    CountersUpgradeable.Counter private _tokenIds;                      // global NFT counter
    mapping(uint256 => SBTType) public sbtTypes;                        // typeId => data
    mapping(uint256 => bool)    public whitelistEnabled;                // typeId => flag
    mapping(uint256 => mapping(address => bool)) public whitelist;      // typeId => user => allowed
    mapping(uint256 => mapping(address => bool)) public hasClaimed;     // typeId => user => claimed?
    mapping(uint256 => uint256) public typeOf;                          // tokenId => typeId
    mapping(address => uint256[]) private _ownedTokens;                // user => tokenIds

    /* --------------------------------------------------------------------- */
    /*                                Events                                 */
    /* --------------------------------------------------------------------- */

    event SBTTypeCreated(uint256 indexed typeId, string uri, uint256 maxSupply);
    event SBTTypeActivated(uint256 indexed typeId, bool status);
    event Claimed(address indexed user, uint256 indexed typeId, uint256 tokenId);
    event Airdropped(address indexed user, uint256 indexed typeId, uint256 tokenId);

    /* --------------------------------------------------------------------- */
    /*                              Initializer                              */
    /* --------------------------------------------------------------------- */

    function initialize(address initialOwner) public initializer {
        __ERC721_init("Web Access SBT", "W3SBT");
        __Ownable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        transferOwnership(initialOwner);
    }

    /* --------------------------------------------------------------------- */
    /*                          Admin‑only Functions                         */
    /* --------------------------------------------------------------------- */

    function createSBTType(
        uint256 typeId,
        string  calldata uri,
        bool    burnable_,
        uint256 maxSupply_,
        bool    useWhitelist
    ) external onlyOwner {
        require(typeId != 0,                "typeId 0 reserved");
        require(bytes(uri).length > 0,      "URI required");
        require(maxSupply_ > 0,             "Supply must be >0");
        require(sbtTypes[typeId].maxSupply == 0, "Type exists");

        sbtTypes[typeId] = SBTType({
            uri:        uri,
            burnable:   burnable_,
            active:     false,        // admin activates later
            maxSupply:  maxSupply_,
            minted:     0
        });

        if (useWhitelist) whitelistEnabled[typeId] = true;

        emit SBTTypeCreated(typeId, uri, maxSupply_);
    }

    function setActive(uint256 typeId, bool status) external onlyOwner {
        require(sbtTypes[typeId].maxSupply > 0, "Type not found");
        sbtTypes[typeId].active = status;
        emit SBTTypeActivated(typeId, status);
    }

    function addToWhitelist(uint256 typeId, address[] calldata users) external onlyOwner {
        require(whitelistEnabled[typeId], "Whitelist off");
        for (uint256 i = 0; i < users.length; ++i) {
            whitelist[typeId][users[i]] = true;
        }
    }

    function airdropTo(uint256 typeId, address[] calldata users) external onlyOwner {
        SBTType storage t = sbtTypes[typeId];
        require(t.active, "Type inactive");

        for (uint256 i = 0; i < users.length && t.minted < t.maxSupply; ++i) {
            address user = users[i];
            if (hasClaimed[typeId][user]) continue;

            _mintToken(user, typeId);
            emit Airdropped(user, typeId, _tokenIds.current());
        }
    }

    /* --------------------------------------------------------------------- */
    /*                             Public Claim                              */
    /* --------------------------------------------------------------------- */

    function claim(uint256 typeId) external nonReentrant {
        SBTType storage t = sbtTypes[typeId];
        require(t.active,                       "Type inactive");
        require(!hasClaimed[typeId][msg.sender],"Already claimed");
        require(t.minted < t.maxSupply,         "Sold out");

        if (whitelistEnabled[typeId]) {
            require(whitelist[typeId][msg.sender], "Not whitelisted");
        }

        _mintToken(msg.sender, typeId);
        emit Claimed(msg.sender, typeId, _tokenIds.current());
    }

    /* --------------------------- Internal Mint --------------------------- */

    function _mintToken(address to, uint256 typeId) internal {
        sbtTypes[typeId].minted += 1;
        _tokenIds.increment();
        uint256 tokenId = _tokenIds.current();
        hasClaimed[typeId][to] = true;
        typeOf[tokenId] = typeId;
        _ownedTokens[to].push(tokenId); // Track manually
        _safeMint(to, tokenId);
    }

    /* --------------------------------------------------------------------- */
    /*                                Views                                  */
    /* --------------------------------------------------------------------- */

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Nonexistent token");
        return sbtTypes[typeOf[tokenId]].uri;
    }

    function tokensOfOwner(address owner) external view returns (uint256[] memory) {
        return _ownedTokens[owner];
    }

    /* --------------------------------------------------------------------- */
    /*                            Soulbound Hook                             */
    /* --------------------------------------------------------------------- */

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override {
        require(from == address(0) || to == address(0), "Soulbound");
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    /* --------------------------------------------------------------------- */
    /*                          UUPS Auth Function                           */
    /* --------------------------------------------------------------------- */

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}

