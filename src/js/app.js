/* variables */
const BET_AMOUNT = 10000000000000000; /* 0,01 ether, around $6 */
let GAS = 900000;
let GAS_PRICE = 2000000000;
const bets = [];
let account;
let contract;
let lastPosition = 0;
let wheelSpinCounter = 0;
let firstBetAfterSpin = true;
let web3Provider = null;
let lastBlockEvent = 0;
let provider;
let chainId = 11155111; // sepolia test network
let infuraURL = 'https://sepolia.infura.io/v3/';

// Unpkg imports
const Web3Modal = window.Web3Modal.default;
const WalletConnectProvider = window.WalletConnectProvider.default;


const betTypes = [
  'color', 'column', 'dozen',
  'eighteen', 'modulus', 'number'
];

function showWarning(msg) {
  var p = document.getElementById('warning');
  p.innerHTML = msg;
  p.style.display = 'block';
}

function init() {

  showWarning('You need <a href="https://metamask.io/">Metamask</a> installed and connected to the Sepolia network. Follow instructions on <a href="https://github.com/VadzimBelski-ScienceSoft/eth-roulette-for-blockchain-presentation">Github</a>.');

  console.log("Initializing the app");

  // Tell Web3modal what providers we have available.
  // Built-in web browser provider (only one can exist as a time)
  // like MetaMask, Brave or Opera is added automatically by Web3modal
  const providerOptions = {
    walletconnect: {
      package: WalletConnectProvider,
      options: {
        chainId: chainId,
        infuraId: "f1a6a5d57420473b975975c55f5d3666"
      }
    }
  };

  web3Modal = new Web3Modal({
    cacheProvider: false, // optional
    providerOptions, // required
  });

}

/**
 * Connect wallet button pressed.
 */
async function onConnect() {

  console.log("Opening a dialog", web3Modal);
  try {
    provider = await web3Modal.connect();
  } catch(e) {
    console.log("Could not get a wallet connection", e);
    return;
  }

  document.querySelector("#prepare").style.display = "none";
  document.querySelector("#connected").style.display = "block";

  await initWeb3();
}

/**
 * Disconnect wallet button pressed.
 */
async function onDisconnect() {

  console.log("Killing the wallet connection", provider);

  // TODO: Which providers have close method?
  if(provider.close) {
    await provider.close();

    // If the cached provider is not cleared,
    // WalletConnect will default to the existing session
    // and does not allow to re-scan the QR code with a new wallet.
    // Depending on your use case you may want or want not his behavir.
    await web3Modal.clearCachedProvider();
    provider = null;
  }

  selectedAccount = null;

  // Set the UI back to the initial state
  document.querySelector("#prepare").style.display = "block";
  document.querySelector("#connected").style.display = "none";
}


/**
 * Main entry point.
 */
window.addEventListener('load', async () => {
  document.querySelector("#btn-connect").addEventListener("click", onConnect);
  document.querySelector("#btn-disconnect").addEventListener("click", onDisconnect);
});

async function initWeb3() {

  web3 = new Web3(provider);

  // Get list of accounts of the connected wallet
  const accounts = await web3.eth.getAccounts();

  account = accounts[0];
  console.log("User account is:"+account);

  var timeleft = 80;
  var blockTimer = setInterval(function(){
    if(timeleft <= 0){
      timeleft = 80;
    }
    document.getElementById("blockProgressBar").value = 80 - timeleft;
    timeleft -= 1;
  }, 1000);

  web3.eth.subscribe('newBlockHeaders', async function (error, result) {
    latestBlock=await web3.eth.getBlockNumber();
    console.log(latestBlock);
    showError('New block number is: ' + latestBlock);

    timeleft = 80;
  });

  if (provider && provider.networkVersion !== chainId) {

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: web3.utils.toHex(chainId) }]
      });
    } catch (err) {
      // This error code indicates that the chain has not been added to MetaMask
      if (err.code === 4902) {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainName: 'Sepolia Test Network',
              chainId: web3.utils.toHex(chainId),
              nativeCurrency: { name: 'SepoliaETH', decimals: 18, symbol: 'SepoliaETH' },
              rpcUrls: [infuraURL]
            }
          ]
        });
      }
    }

    // detect Network account change
    provider.on('chainChanged', function(networkId){
      console.log('chainChanged',networkId);

      if (provider.networkVersion !== chainId) {

        showError('networkChanged to not supported network - switch netwotk in Matamask');

        provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: web3.utils.toHex(chainId) }]
        });

      }
    });

    provider.on('accountsChanged', function (accounts) {
      // Time to reload your interface with accounts[0]!
      console.log(accounts[0]);
      account = accounts[0];

      getStatus();
    });

  }

  await initContract();

}

async function initContract() {
  // get abi and deployed address
  $.getJSON('Roulette.json', (data) => {

    let address = '0x136276eab7874Cf3B9BF468fb5CAf549b975BDa8';

    // get contract instance
    const abi = data.abi;

    console.log(data);

    contract = new web3.eth.Contract(data.abi, address, {
      from: account // default from address
    });

    initEventListeners();

    getStatus();

  });
}

function initEventListeners() {

  contract.events.MadeBet({}, function (err, res) {
    if (err) return void showError('Event listner error MadeBet', err);

    bet = { type: 5, value: parseInt(res.returnValues._value) , account: res.returnValues._from};

    pushBet(bet);

    getStatus();

  });

  /* listening for events from the smart contract */
  contract.events.RandomNumber({}, function (err, res) {

    if (res.blockNumber > lastBlockEvent) {

      /* prevent duplicated events */
      /* 'random' number generated by the smart contract */
      const oneRandomNumber = parseInt(res.returnValues.number);
      /* increment spin counter */
      wheelSpinCounter += 1;
      /* get wheel element */
      var wheel = document.getElementById("wheel");
      /* reset wheel */
      wheel.style.transform = "rotate(" + lastPosition + "deg)";
      /* numbers in the wheel, ordered clockwise */
      var numbers = [
        0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27,
        13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1,
        20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
      ];
      /* calculate how much do we need to rotate to have the random number chosen */
      var numberDegree = numbers.indexOf(oneRandomNumber) * 360 / numbers.length;
      /* add some rounds before to look like it's spinning */
      var numRoundsBefore = 3 * wheelSpinCounter;
      /* calculate total degrees we need to rotate */
      var totalDegrees = (numRoundsBefore * 360) + numberDegree;

      /* rotate the wheel */
      document.getElementById("wheel").style.transform = "rotate(-" + totalDegrees + "deg)";
      /* save position to be able to reset the wheel next time */
      lastPosition = numberDegree;
      /* show status on bets after wheel stops */
      setTimeout(function () {
        showBetsStatus(oneRandomNumber);
      }, 2000);
      lastBlockEvent = res.blockNumber;

      getStatus();
    }
  });
}

function showError(msg, err) {
  console.log(msg);
  console.log(err);
  const p = document.getElementById('errorPanel');
  p.innerText = msg;
  setTimeout(function () {
    p.innerHTML = '&nbsp;';
  }, 4000);
}

function hideBets() {
  var div = document.getElementById('betsList');
  while (div.firstChild) {
    div.removeChild(div.firstChild);
  }
}

function cleanBets() {
  bets.length = 0;
  hideBets();
}

function placeBet() {
  let area = this.id;
  let bet = {};
  if (/^n\d\d/.test(area)) bet = { type: 5, value: parseInt(area.substr(1)) , account: account};

  if (bet.hasOwnProperty('type') && bet.hasOwnProperty('value')) {

    contract.methods.bet(bet.value).send({ value: BET_AMOUNT }, function (err, res) {
      if (err) {
        return void showError('not enough money in the bank', err);
      }
      pushBet(bet);
    });

    getStatus();
  }
}

function pushBet(hash) {

  if (firstBetAfterSpin) {
    cleanBets();
  }

  firstBetAfterSpin = false;

  bets.push(hash);

  printBet(hash);

}

function printBet(hash) {

  const value = hash.value ;
  const address = hash.account ;
  const div = document.getElementById('betsList');
  const p = document.createElement('p');
  p.innerText = 'Address '+address + ' Number: ' + value + '';

  if (hash.hasOwnProperty('status')) {
    p.innerText += (hash.status ? 'WIN' : 'LOST');
  }

  div.appendChild(p);
}

function showBetsStatus(num) {
  hideBets();
  bets.map(function (bet) {
    printBet(bet);
  })
}

function spinWheel() {
  contract.methods.spinWheel().send({ from: account, value: 0, gas: GAS, gasPrice: GAS_PRICE }, function (err, res) {
    if (err) return void showError('to soon to play?', err);
    firstBetAfterSpin = true;
  });
}

function toEther(bigNum) {
  return (Number(bigNum / BigInt(1000000000000000000))).toFixed(2)
}

function updateHTML(value, elId) {
  const span = document.getElementById(elId);
  span.innerText = value;
}

/* call smart contract to get status and update UI */
function getStatus() {

  console.log("entering get status");

  contract.methods.getStatus().call()
      .then(function (result) {
        console.log("get status", result);

        updateHTML(result[0], 'betsCount');                             // bets count
        result[1] = toEther(result[1]);                                   // bets value
        updateHTML(result[1], 'betsValue');
        const now = Math.round(new Date() / 1000);                  // time until next spin

        updateHTML(result[2], 'timeUntilNextSpin');
        result[3] = toEther(result[3]);                                   // roulette balance
        updateHTML(result[3], 'balance');
        result[4] = toEther(result[4]);                                   // winnings
        updateHTML(result[4], 'winnings');

        web3.eth.getBalance(account).then(function (balance) {
          balance = toEther(balance);
          updateHTML(balance, 'yourBalance');
        })

        let allBets = result[5];

        cleanBets();

        allBets.forEach(function(element) {

          //console.log(element);

          bet = { type: 5, value: parseInt(element.number), account: element.player };

          pushBet(bet);
        });

      })
      .catch(function(error) {
        return void showError('something went wrong with getStatus', error);
      });
}

document.addEventListener('DOMContentLoaded', function () {
  /* adds click event to roulette table */
  var areas = document.getElementsByTagName('area');
  for (i = 0; i < areas.length; i++) {
    areas[i].onclick = placeBet;
  };
  init();
})
