import { ethers } from 'ethers';

export const toEther = (n) => {
    return ethers.formatEther(n.toString())
}

export const toWei = (n) => {
    return ethers.parseEther(n.toString())
}

export const formatBalance = (balance) => {
    return Number.parseFloat(toEther(balance)).toFixed(4)
}