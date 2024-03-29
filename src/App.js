import './App.css';
import { ethers } from "ethers";
import { useEffect, useState } from "react";
import { smartSwapFactoryAddress, smartSwapFactoryAbi, smartSwapPoolAbi, iERC20TokenAbi } from './constants/constants';
import { formatBalance, toWei, toEther } from './utils/utils';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  // JS "enums"
  const Tab = {
    Swap: "Swap",
    Liquidity: "Liquidity"
  }
  const Action = {
    None: "None",
    SelectOriginToken: "SelectOriginToken",
    SelectDestinationToken: "SelectDestinationToken",
    CreatePair: "CreatePair",
    InitLP: "InitLP",
    AddLiquidity: "AddLiquidity",
    RemoveLiquidity: "RemoveLiquidity"
  }

  // General web3 vars
  const [isConnected, setIsConnected] = useState(false);
  const [hasMetamask, setHasMetamask] = useState(false);
  const [signer, setSigner] = useState(undefined);
  const [accountAddress, setAccountAddress] = useState(undefined);
  const [balance, setBalance] = useState(0);
  // Navigation vars
  const [tab, setTab] = useState(Tab.Swap);
  const [showModal, setShowModal] = useState(false);
  const [action, setAction] = useState(Action.None);
  // General dapp vars
  const [smartSwapFactory, setSmartSwapFactory] = useState();
  const [smartSwapPoolsData, setSmartSwapPoolsData] = useState([]);
  const [availableTokens, setAvailableTokens] = useState([]);
  // Swap vars
  const [swapLP, setSwapLP] = useState();
  const [originToken, setOriginToken] = useState();
  const [destinationToken, setDestinationToken] = useState();
  const [originAmount, setOriginAmount] = useState(0);
  const [destinationAmount, setDestinationAmount] = useState(0);
  const [originBalance, setOriginBalance] = useState(0);
  const [destinationBalance, setDestinationBalance] = useState(0);
  // LP vars
  const [selectedLP, setSelectedLP] = useState();
  const [token0DepositAmount, setToken0DepositAmount] = useState(0);
  const [token1DepositAmount, setToken1DepositAmount] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [token0DepositBalance, setToken0DepositBalance] = useState(0);
  const [token1DepositBalance, setToken1DepositBalance] = useState(0);
  // New pair
  const [newPairToken0Address, setNewPairToken0Address] = useState();
  const [newPairToken1Address, setNewPairToken1Address] = useState();

  useEffect(() => {
    if (typeof window.ethereum !== "undefined") {
      setHasMetamask(true);
    }
  });

  useEffect(() => {
    async function fetchPools() {
      if(smartSwapFactory) {
        await updateSmartSwapPoolsData();
      }
    }
    fetchPools();
  }, [smartSwapFactory]);

  useEffect(() => {
    updateAvailableTokens();
  }, [smartSwapPoolsData]);

  useEffect(() => {
    async function getBalance() {
      if(originToken){
        const tokenContract = new ethers.Contract(originToken.address, iERC20TokenAbi, signer);
        let balanceOf = await tokenContract.balanceOf(accountAddress);
        setOriginBalance(balanceOf);
      }
    }
    getBalance();
    updateSwapLP();
  }, [originToken]);

  useEffect(() => {
    async function getBalance() {
      if(destinationToken){
        const tokenContract = new ethers.Contract(destinationToken.address, iERC20TokenAbi, signer);
        let balanceOf = await tokenContract.balanceOf(accountAddress);
        setDestinationBalance(balanceOf);
      }
    }
    getBalance();
    updateSwapLP();
  }, [destinationToken]);

  useEffect(() => {
    async function getBalances() {
      if(selectedLP){
        const token0Contract = new ethers.Contract(selectedLP.token0.address, iERC20TokenAbi, signer);
        const token1Contract = new ethers.Contract(selectedLP.token1.address, iERC20TokenAbi, signer);
        let t0Balance = await token0Contract.balanceOf(accountAddress);
        let t1Balance = await token1Contract.balanceOf(accountAddress);
        setToken0DepositBalance(t0Balance);
        setToken1DepositBalance(t1Balance);
      }
    }
    getBalances();
  }, [selectedLP]);

  useEffect(() => {
    if(showModal)
      document.body.classList.add('overflow-hidden');
    else {
      document.body.classList.remove('overflow-hidden');
      setAction(Action.None);
    }
  }, [showModal]);

  const connectWallet = async () => {
    if (typeof window.ethereum !== "undefined") {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      setSigner(signer);
      setIsConnected(true);
      const accountAddress = await signer.getAddress();
      setAccountAddress(accountAddress);
      const balance = await provider.getBalance(accountAddress);
      setBalance(balance);
      const contract = await new ethers.Contract(smartSwapFactoryAddress, smartSwapFactoryAbi, signer);
      setSmartSwapFactory(contract);
    } else {
      console.log("Please Install Metamask!!!");
    }
  }

  const getSmartSwapPoolData = async (poolAddress) => {
    const poolContract = new ethers.Contract(poolAddress, smartSwapPoolAbi, signer);
    const token0Address = await poolContract.token0();
    const token1Address = await poolContract.token1();
    const totalLiquidity = await poolContract.totalLiquidity();
    const myLiquidity = await poolContract.liquidity(accountAddress);

    const token0Contract = new ethers.Contract(token0Address, iERC20TokenAbi, signer);
    const token0Name = await token0Contract.name();
    const token0Symbol = await token0Contract.symbol();
    const token0 = { address: token0Address, name: token0Name, symbol: token0Symbol };
    const token1Contract = new ethers.Contract(token1Address, iERC20TokenAbi, signer);
    const token1Name = await token1Contract.name();
    const token1Symbol = await token1Contract.symbol();
    const token1 = { address: token1Address, name: token1Name, symbol: token1Symbol };

    return {
      address : poolAddress,
      totalLiquidity : totalLiquidity,
      myLiquidity : myLiquidity,
      token0 : token0,
      token1 : token1
    }
  }

  const updateSmartSwapPoolsData = async () => {
    let poolsData = [];
    let liquidityPoolLength = await smartSwapFactory.getLiquidityPoolsLength();
    for(let i = 0; i < liquidityPoolLength; i++){
      let poolAddress = await smartSwapFactory.allLiquidityPools(i);
      let smartSwapPoolData = await getSmartSwapPoolData(poolAddress);
      poolsData.push(smartSwapPoolData);
    }
    
    setSmartSwapPoolsData(poolsData);
  }

  const containsToken = (tokens, token) => {
    for(let i = 0; i < tokens.length; i++){
      if(tokens[i].address == token.address)
        return true;
    }
    return false
  }

  const updateAvailableTokens = () => {
    let tokens = [];
    for(let i = 0; i < smartSwapPoolsData.length; i++){
      if(!containsToken(tokens, smartSwapPoolsData[i].token0)) {
        tokens.push(smartSwapPoolsData[i].token0);
      }
      if(!containsToken(tokens, smartSwapPoolsData[i].token1)) {
        tokens.push(smartSwapPoolsData[i].token1);
      }
    }

    setAvailableTokens(tokens);
  }

  const setDepositAmountsByToken0 = async (token0Amount) => {
    let pattern = /^[0-9]+(\.)?[0-9]*$/;
    if(token0Amount != "" && !pattern.test(token0Amount))
      return;

    setToken0DepositAmount(token0Amount);
    if(token0Amount == "") {
      setToken1DepositAmount("");
    }
    else {
      const poolContract = new ethers.Contract(selectedLP.address, smartSwapPoolAbi, signer);
      const reserves = await poolContract.getTokenReserves();
      let token1Amount = toWei(token0Amount) * reserves[1] / reserves[0];
      setToken1DepositAmount(formatBalance(token1Amount));
    }
  }

  const setDepositAmountsByToken1 = async (token1Amount) => {
    let pattern = /^[0-9]+(\.)?[0-9]*$/;
    if(token1Amount != "" && !pattern.test(token1Amount))
      return;

    setToken1DepositAmount(token1Amount);
    if(token1Amount == "") {
      setToken0DepositAmount("");
    }
    else {
      const poolContract = new ethers.Contract(selectedLP.address, smartSwapPoolAbi, signer);
      const reserves = await poolContract.getTokenReserves();
      let token0Amount = toWei(token1Amount) * reserves[0] / reserves[1];
      setToken0DepositAmount(formatBalance(token0Amount));
    }
  }

  const setAndFormatWithdrawAmount = (amount) => {
    let pattern = /^[0-9]+(\.)?[0-9]*$/;
    if(amount != "" && !pattern.test(amount))
      return;

    setWithdrawAmount(amount);
  }

  const updateSwapLP = () => {
    if(originToken && destinationToken) {
      for(let i = 0; i < smartSwapPoolsData.length; i++) {
        let pool = smartSwapPoolsData[i];
        let tokens = [pool.token0.address, pool.token1.address];
        if(tokens.includes(originToken.address) && tokens.includes(destinationToken.address)) {
          setSwapLP(pool);
          return;
        }
      }
    }

    setSwapLP(null);
  }

  const setAmountsByOriginAmount = async (inputAmount) => {
    let pattern = /^[0-9]+(\.)?[0-9]*$/;
    if(inputAmount != "" && !pattern.test(inputAmount))
      return;

    setOriginAmount(inputAmount);
    if(destinationToken) {
      if(inputAmount == "") {
        setDestinationAmount("");
      }
      else {
        let amountInWei = toWei(inputAmount);
        if(amountInWei == 0)
          setDestinationAmount(0);
        else {
          let token0ToToken1 = swapLP.token0.address == originToken.address;
          const poolContract = new ethers.Contract(swapLP.address, smartSwapPoolAbi, signer);
          let outputAmount = await poolContract.getSwapOutput(token0ToToken1, amountInWei);
          setDestinationAmount(formatBalance(outputAmount));
        }
      }
    }
  }

  const setAmountsByDestinationAmount = async (outputAmount) => {
    let pattern = /^[0-9]+(\.)?[0-9]*$/;
    if(outputAmount != "" && !pattern.test(outputAmount))
      return;

    setDestinationAmount(outputAmount);
    if(originToken) {
      if(outputAmount == "") {
        setOriginAmount("");
      }
      else {
        let amountInWei = toWei(outputAmount);
        if(amountInWei == 0)
          setOriginAmount(0);
        else {
          let token0ToToken1 = swapLP.token0.address == originToken.address;
          const poolContract = new ethers.Contract(swapLP.address, smartSwapPoolAbi, signer);
          let inputAmount = await poolContract.getSwapInput(token0ToToken1, amountInWei);
          setOriginAmount(formatBalance(inputAmount));
        }
      }
    }
  }

  const HasEnoughAllowance = async () => {
    let token0Contract = new ethers.Contract(selectedLP.token0.address, iERC20TokenAbi, signer);
    let token1Contract = new ethers.Contract(selectedLP.token1.address, iERC20TokenAbi, signer);
    let allowance0 = await token0Contract.allowance(accountAddress, selectedLP.address);
    let allowance1 = await token1Contract.allowance(accountAddress, selectedLP.address);

    return allowance0 >= toWei(token0DepositAmount) && allowance1 >= toWei(token1DepositAmount);
  }

  const ApproveTokens = async () => {
    let token0Contract = new ethers.Contract(selectedLP.token0.address, iERC20TokenAbi, signer);
    let token1Contract = new ethers.Contract(selectedLP.token1.address, iERC20TokenAbi, signer);
    try {
      await token0Contract.approve(selectedLP.address, toWei(token0DepositAmount));
      await token1Contract.approve(selectedLP.address, toWei(token1DepositAmount));
    }
    catch(e) {
      throw e;
    }
    toast.success('Tokens approved');
  }

  const createNewPair = async () => {
    if(newPairToken0Address.length < 42 || newPairToken1Address.length < 42 || 
      newPairToken0Address.substr(0, 2) != "0x" || newPairToken1Address.substr(0, 2) != "0x") {
      toast.error("Invalid token addresses");
      return;
    }

    try {
      let trx = await smartSwapFactory.createPool(newPairToken0Address, newPairToken1Address);
      await trx.wait();
    }
    catch(e) {
      console.log(e);
      toast.error('Unknown error');
      return;
    }

    setShowModal(false);
    toast.success('New pair created');
    await updateSmartSwapPoolsData();
  }

  const initLP = async () => {
    let hasEnoughAllowance = await HasEnoughAllowance();
    if(!hasEnoughAllowance){
      toast.error('Not enough allowance');
      return;
    }
    
    try {
      const poolContract = new ethers.Contract(selectedLP.address, smartSwapPoolAbi, signer);
      let trx = await poolContract.init(toWei(token0DepositAmount), toWei(token1DepositAmount));
      await trx.wait();
    }
    catch(e) {
      console.log(e);
      toast.error('Unknown error');
      return;
    }

    setShowModal(false);
    toast.success('Liquidity pool initialized');
    await updateSmartSwapPoolsData();
  }

  const addLiquidity = async () => {
    try{
      const poolContract = new ethers.Contract(selectedLP.address, smartSwapPoolAbi, signer);
      let trx = await poolContract.addLiquidity(toWei(token0DepositAmount));
      await trx.wait();
    }
    catch(e) {
      console.log(e);
      toast.error('Unknown error');
      return;
    }

    setShowModal(false);
    toast.success('Liquidity added');
    await updateSmartSwapPoolsData();
  }

  const removeLiquidity = async () => {
    try {
      const poolContract = new ethers.Contract(selectedLP.address, smartSwapPoolAbi, signer);
      let trx = await poolContract.removeLiquidity(toWei(withdrawAmount));
      await trx.wait();
    }
    catch(e) {
      console.log(e);
      toast.error('Unknown error');
      return;
    }

    setShowModal(false);
    toast.success('Liquidity removed');
    await updateSmartSwapPoolsData();
  }

  const swap = async () => {
    if(swapLP) {
      // Swap
      let token0ToToken1 = swapLP.token0.address == originToken.address;
      const poolContract = new ethers.Contract(swapLP.address, smartSwapPoolAbi, signer);
      let trx = await poolContract.swap(token0ToToken1, originAmount);
      await trx.wait();

      // Todo: Update originBalance and destinationBalance
      toast.success('Tokens traded');
      await updateSmartSwapPoolsData();
    }
    else {
      // Pair doesnt exist
      console.log("Pair does not exist");
      toast.error('Liquidity pair not created');
    }
  }

  return (
    <div className="App min-h-screen">
      <ToastContainer position="bottom-center" limit={1} />
      <header className="App-header">
        <div className="max-w-screen-lg flex flex-wrap items-center justify-between mx-auto p-4">
          <a className="flex cursor-pointer custom-color text-2xl font-bold">
            SmartSwap
          </a>
          <div className="menu flex items-center text-white font-bold text-xl">
            <div className={tab == Tab.Swap ? "menu-item cursor-pointer mx-6 px-1 pb-1 border-b-4" : "menu-item cursor-pointer mx-6 px-1 pb-1 border-b-2"} 
              onClick={() => setTab(Tab.Swap)}
            >
              Swap
            </div>
            <div className={tab == Tab.Liquidity ? "menu-item cursor-pointer mx-6 px-1 pb-1 border-b-4" : "menu-item cursor-pointer mx-6 px-1 pb-1 border-b-2"} 
              onClick={() => setTab(Tab.Liquidity)}
            >
              Liquidity
            </div>
          </div>
          { 
            isConnected ? 
            (
              <button className="flex custom-background text-white font-bold py-2 px-4 rounded">
                { accountAddress.slice(0, 6) + '...' + accountAddress.slice(-4) }
              </button>
            )
            :
            (
              <button className="uppercase flex custom-background custom-background-hover text-white font-bold py-2 px-4 rounded" 
                onClick={ () => connectWallet() }
              >
                Connect
              </button>
            )
          }
        </div>
      </header>
      <div className="container max-w-screen-lg mx-auto pt-20">
        { 
          tab == Tab.Swap ?
          (
            <div className="max-w-lg rounded-xl overflow-hidden shadow-lg mx-auto custom-background2 border-2 custom-border2">
              <div className="px-20 py-10">
                <div className="swap-input-container my-4">
                  <div className="mb-1">
                    <button 
                      className="custom-background custom-background-hover text-white font-bold py-1 px-4 rounded-xl disabled:opacity-50" 
                      onClick={ () => { setAction(Action.SelectOriginToken); setShowModal(true); } }
                      disabled={!isConnected}
                    >
                      { originToken ? originToken.symbol : "Select token" }
                    </button>
                    { originToken && (<span className="text-white">{ formatBalance(originBalance) }</span>) }
                  </div>
                  <input 
                    type="text" 
                    value={originAmount} 
                    onChange={ (e) => setAmountsByOriginAmount(e.target.value) } 
                    className="rounded w-full p-3 focus:outline-none font-bold text-gray-500 border-2 custom-border">
                  </input>
                </div>
                <div className="swap-output-container my-4">
                  <div className="mb-1">
                    <button 
                      className="custom-background custom-background-hover text-white font-bold py-1 px-4 rounded-xl disabled:opacity-50" 
                      onClick={ () => { setAction(Action.SelectDestinationToken); setShowModal(true); } }
                      disabled={!isConnected}
                    >
                      { destinationToken ? destinationToken.symbol : "Select token" }
                    </button>
                    { destinationToken && (<span className="text-white">{ formatBalance(destinationBalance) }</span>) }
                  </div>
                  <input 
                    type="text" 
                    value={destinationAmount} 
                    onChange={ (e) => setAmountsByDestinationAmount(e.target.value) } 
                    className="rounded w-full p-3 focus:outline-none font-bold text-gray-500 border-2 custom-border">
                  </input>
                </div>
                <button className="custom-background custom-background-hover text-white font-bold py-2 px-4 rounded-xl disabled:opacity-50" 
                  onClick={ () => swap() }
                  disabled={!isConnected}
                >
                  { isConnected ? "Swap" : "Connect your metamask" }
                </button>
              </div>
            </div>
          )
          :
          (
            <div>
              {
                isConnected ?
                <div className="w-full my-2">
                  <button 
                    className="custom-background custom-background-hover text-white font-bold py-2 px-4 rounded-xl" 
                    onClick={ () => { setAction(Action.CreatePair); setShowModal(true); } }
                  >
                    Create new pair
                  </button>
                </div>
                :
                null
              }
              <div className="table-container border-solid border-2 rounded-xl custom-border2 custom-background2 shadow text-white ">
                <table className="table-auto w-full">
                  <thead>
                    <tr>
                      <th className='text-left border-b-2 custom-border2 p-4'>Token pair</th>
                      <th className='text-left border-b-2 custom-border2 p-4'>My liquidity</th>
                      <th className='text-left border-b-2 custom-border2 p-4'>Total liquidity</th>
                      <th className='text-left border-b-2 custom-border2 p-4'>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {
                      !isConnected ?
                        <tr><td className="p-4 text-center font-bold" colSpan="4">Connect your metamask</td></tr>
                      : 
                      smartSwapPoolsData.length > 0 ?
                        smartSwapPoolsData.map((pool) => (
                          <tr key={pool.address}>
                            <td className="border-b custom-border2 p-4">{`${pool.token0.symbol} <=> ${pool.token1.symbol}`}</td>
                            <td className="border-b custom-border2 p-4">{formatBalance(pool.myLiquidity)}</td>
                            <td className="border-b custom-border2 p-4">{formatBalance(pool.totalLiquidity)}</td>
                            {
                              pool.totalLiquidity > 0 ? (
                                <td className="border-b custom-border2 p-4">
                                  <button 
                                    className="custom-background custom-background-hover text-white font-bold py-2 px-4 rounded-xl mx-1" 
                                    onClick={ () => { setSelectedLP(pool); setAction(Action.AddLiquidity); setShowModal(true); }}
                                  >
                                    Add liquidity
                                  </button>
                                  <button 
                                    className="custom-background custom-background-hover text-white font-bold py-2 px-4 rounded-xl mx-1" 
                                    onClick={ () => { setSelectedLP(pool); setAction(Action.RemoveLiquidity); setShowModal(true); }}
                                  >
                                    Remove liquidity
                                  </button>
                                </td>
                              ) :
                              (
                                <td className="border-b custom-border2 p-4">
                                  <button 
                                    className="custom-background custom-background-hover text-white font-bold py-2 px-4 rounded-xl" 
                                    onClick={ () => { setSelectedLP(pool); setAction(Action.InitLP); setShowModal(true); }}
                                  >
                                    Init LP
                                  </button>
                                </td>
                              )
                            }
                          </tr>
                        ))
                      : <tr><td className="p-4 text-center font-bold" colSpan="4">No liquidity pairs</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )
        }
      </div>
      { /* Modal */ }
      { showModal &&
        (
          <div className="modal">
            <div className="flex justify-center items-center overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none">
              <div className="modal-overlay z-10" onClick={ () => { setShowModal(false); setAction(Action.None); }}></div>
              <div className="modal-content p-10 max-w-lg w-full shadow-lg custom-background2 z-20 border-2 custom-border2 rounded-xl">
                { 
                  action == Action.CreatePair ?
                    <div className="create-pair-container">
                      <label className="text-white font-bold">Token address 1</label>
                      <input 
                        type="text" 
                        value={newPairToken0Address} 
                        onChange={ (e) => setNewPairToken0Address(e.target.value) } 
                        className="rounded w-full p-3 focus:outline-none font-bold text-gray-500 border-2 custom-border mb-2">
                      </input>
                      <label className="text-white font-bold">Token address 2</label>
                      <input 
                        type="text" 
                        value={newPairToken1Address} 
                        onChange={ (e) => setNewPairToken1Address(e.target.value) } 
                        className="rounded w-full p-3 focus:outline-none font-bold text-gray-500 border-2 custom-border mb-2">
                      </input>
                      <button 
                        className="custom-background custom-background-hover text-white font-bold py-2 px-4 rounded-xl mt-2" 
                        onClick={ () => createNewPair() }
                      >
                        Create new pair
                      </button>
                    </div>
                  : action == Action.SelectDestinationToken ?
                    (<div>
                      <h5 className="text-white font-bold ml-4 mb-4">Select token</h5>
                      {
                        availableTokens.map((token) => (
                          <div 
                            key={token.address} 
                            onClick={() => { setDestinationToken(token); setShowModal(false); }}
                            className="max-w-sm cursor-pointer text-white py-1 px-4 m-4 inline custom-background custom-background-hover rounded-xl"
                          >
                            {token.symbol}
                          </div>
                        ))
                      }
                    </div>)
                  : action == Action.SelectOriginToken ?
                    (<div>
                      <h5 className="text-white font-bold ml-4 mb-4">Select token</h5>
                      {
                        availableTokens.map((token) => (
                          <div 
                            key={token.address} 
                            onClick={() => { setOriginToken(token); setShowModal(false);}}
                            className="max-w-sm cursor-pointer text-white py-1 px-4 m-4 inline custom-background custom-background-hover rounded-xl"
                          >
                            {token.symbol}
                          </div>
                        ))
                      }
                    </div>)
                  : action == Action.InitLP ?
                    <div className="init-liquidity-container">
                      <div className="liquidity-token0-container">
                        <div className="">
                          <button className="custom-background text-white font-bold py-1 px-4 my-1 rounded-xl">
                            { selectedLP.token0.symbol }
                          </button>
                          { <span className="ml-2 text-white">{ formatBalance(token0DepositBalance) }</span> }
                        </div>
                        <input 
                          type="text" 
                          value={token0DepositAmount} 
                          onChange={ (e) => setToken0DepositAmount(e.target.value) } 
                          className="rounded w-full p-3 mb-2 focus:outline-none font-bold text-gray-500 border-2 custom-border">
                        </input>
                      </div>
                      <div className="liquidity-token1-container">
                        <div className="">
                          <button className="custom-background text-white font-bold py-1 px-4 my-1 rounded-xl">
                            { selectedLP.token1.symbol }
                          </button>
                          { <span className="ml-2 text-white">{ formatBalance(token1DepositBalance) }</span> }
                        </div>
                        <input 
                          type="text" 
                          value={token1DepositAmount} 
                          onChange={ (e) => setToken1DepositAmount(e.target.value) } 
                          className="rounded w-full p-3 mb-2 focus:outline-none font-bold text-gray-500 border-2 custom-border">
                        </input>
                      </div>
                      <div className="liquidity-buttons-container">
                        <button 
                          className="custom-background custom-background-hover text-white font-bold py-2 px-4 rounded-xl mx-2 mt-2" 
                          onClick={ () => initLP() }
                        >
                          Init liquidity pool
                        </button>
                        <button 
                          className="custom-background custom-background-hover text-white font-bold py-2 px-4 rounded-xl mx-2 mt-2" 
                          onClick={ () => ApproveTokens() }
                        >
                          Approve tokens
                        </button>
                      </div>
                    </div>
                  : action == Action.AddLiquidity ?
                    <div className="add-liquidity-container">
                      <div className="liquidity-token0-container">
                        <div className="">
                          <button className="custom-background text-white font-bold py-1 px-4 my-1 rounded-xl">
                            { selectedLP.token0.symbol }
                          </button>
                          { <span className="ml-2 text-white">{ formatBalance(token0DepositBalance) }</span> }
                        </div>
                        <input 
                          type="text" 
                          value={token0DepositAmount} 
                          onChange={ (e) => setDepositAmountsByToken0(e.target.value) } 
                          className="rounded w-full p-3 mb-2 focus:outline-none font-bold text-gray-500 border-2 custom-border">
                        </input>
                      </div>
                      <div className="liquidity-token1-container">
                        <div className="">
                          <button className="custom-background text-white font-bold py-1 px-4 my-1 rounded-xl">
                            { selectedLP.token1.symbol }
                          </button>
                          { <span className="ml-2 text-white">{ formatBalance(token1DepositBalance) }</span> }
                        </div>
                        <input 
                          type="text" 
                          value={token1DepositAmount} 
                          onChange={ (e) => setDepositAmountsByToken1(e.target.value) } 
                          className="rounded w-full p-3 mb-2 focus:outline-none font-bold text-gray-500 border-2 custom-border">
                        </input>
                      </div>
                      <div className="liquidity-buttons-container">
                        <button 
                          className="custom-background custom-background-hover text-white font-bold py-2 px-4 m-1 rounded-xl" 
                          onClick={ () => addLiquidity() }
                        >
                          Add liquidity
                        </button>
                        <button 
                          className="custom-background custom-background-hover text-white font-bold py-2 px-4 m-1 rounded-xl" 
                          onClick={ () => ApproveTokens() }
                        >
                          Approve tokens
                        </button>
                      </div>
                    </div>
                  : action == Action.RemoveLiquidity ?
                    <div className="remove-liquidity-container">
                      <div className="liquidity-lptoken-container">
                        <div className="">
                          <button className="custom-background text-white font-bold py-1 px-4 my-1 rounded-xl">
                            LP tokens
                          </button>
                          { <span className="ml-2 text-white">{ formatBalance(selectedLP.myLiquidity) }</span> }
                        </div>
                        <input 
                          type="text" 
                          value={withdrawAmount} 
                          onChange={ (e) => setAndFormatWithdrawAmount(e.target.value) } 
                          className="rounded w-full p-3 mb-2 focus:outline-none font-bold text-gray-500 border-2 custom-border">
                        </input>
                      </div>
                      <div className="liquidity-buttons-container">
                        <button 
                          className="custom-background custom-background-hover text-white font-bold py-2 px-4 mt-2 rounded-xl" 
                          onClick={ () => removeLiquidity() }
                        >
                          Remove liquidity
                        </button>
                      </div>
                    </div>
                  :
                    <div>No content</div>
                }
              </div>
            </div>
          </div>
        )
      }
    </div>
  );
}

export default App;