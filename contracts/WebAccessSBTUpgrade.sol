// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";



contract WebAccessSBTV2 is
    ERC721Upgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using CountersUpgradeable for CountersUpgradeable.Counter;

    CountersUpgradeable.Counter private _tokenIds;

    mapping(uint256 => string)  public uriByType;
    mapping(uint256 => bool)    public isActive;
    mapping(uint256 => bool)    public isDeprecated;
    mapping(uint256 => bool)    public isBurnable;

    mapping(uint256 => mapping(address => bool)) public hasClaimed;
    mapping(uint256 => uint256) public typeOf;

    event Claimed(address indexed user, uint256 indexed typeId, uint256 tokenId);
    event Burned(address indexed user, uint256 indexed tokenId);
    event TypeURISet(uint256 indexed typeId, string uri);
    event TypeActive(uint256 indexed typeId, bool active);
    event TypeDeprecated(uint256 indexed typeId, bool deprecated);

    function initialize(address initialOwner) public initializer {
        __ERC721_init("Web Access SBT", "W3SBT");
        __Ownable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        transferOwnership(initialOwner);
    }

    function setTypeURI(uint256 typeId, string calldata uri, bool burnable) external onlyOwner {
        require(typeId != 0, "typeId 0 reserved");
        uriByType[typeId] = uri;
        isBurnable[typeId] = burnable;
        emit TypeURISet(typeId, uri);
    }

    function setActive(uint256 typeId, bool status) external onlyOwner {
        isActive[typeId] = status;
        emit TypeActive(typeId, status);
    }

    function setDeprecated(uint256 typeId, bool status) external onlyOwner {
        isDeprecated[typeId] = status;
        emit TypeDeprecated(typeId, status);
    }

    function forceBurnDeprecated(uint256[] calldata tokenIds) external onlyOwner {
        for (uint256 i = 0; i < tokenIds.length; ++i) {
            uint256 id = tokenIds[i];
            if (_exists(id) && isDeprecated[typeOf[id]]) {
                address prevOwner = ownerOf(id);
                _burn(id);
                emit Burned(prevOwner, id);
            }
        }
    }

    function claim(uint256 typeId) external nonReentrant {
        require(isActive[typeId], "SBT type inactive");
        require(!hasClaimed[typeId][msg.sender], "Already claimed");
        require(bytes(uriByType[typeId]).length != 0, "URI not set");

        _tokenIds.increment();
        uint256 tokenId = _tokenIds.current();

        hasClaimed[typeId][msg.sender] = true;
        typeOf[tokenId] = typeId;

        _safeMint(msg.sender, tokenId);
        emit Claimed(msg.sender, typeId, tokenId);
    }

    // Virtual internal function to check if burn is allowed for typeId
    function _isBurnable(uint256 typeId) internal view virtual returns (bool) {
        return isBurnable[typeId];
    }

    function burn(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        uint256 t = typeOf[tokenId];
        require(isDeprecated[t] || _isBurnable(t), "This SBT cannot be burned");
        _burn(tokenId);
        emit Burned(msg.sender, tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "ERC721: URI query for nonexistent token");
        return uriByType[typeOf[tokenId]];
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize) internal override {
        require(from == address(0) || to == address(0), "Soulbound: transfer blocked");
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}

