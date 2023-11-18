// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestERC20 is ERC20 {
    uint8 private _decimals;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 decimals_
    ) ERC20(_name, _symbol) {
        _decimals = decimals_;
    }

    function mintToken(uint256 _amount, address _recipient) external {
        require(_recipient != address(0), "zero recipient address");
        require(_amount > 0, "zero mint token amount");

        _mint(_recipient, _amount);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
