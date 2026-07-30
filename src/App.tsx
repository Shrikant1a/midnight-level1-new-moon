/// <reference types="vite/client" />
import React, { useState, useEffect } from 'react';
import { Transaction, nativeToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { ZKConfigProvider, createProverKey, createVerifierKey, createZKIR, type ProverKey, type VerifierKey, type ZKIR } from '@midnight-ntwrk/midnight-js-types';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { Contract, ledger } from '../contracts/managed/hello-world/contract/index.js';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { Buffer } from 'buffer';

const compiledContract = CompiledContract.make('hello-world', Contract).pipe(
  CompiledContract.withVacantWitnesses
);

// Custom browser-compatible ZKConfigProvider that fetches keys via HTTP
class BrowserZkConfigProvider extends ZKConfigProvider<string> {
  async getProverKey(circuit: string): Promise<ProverKey> {
    const res = await fetch(`/managed/hello-world/${circuit}.proving-key`);
    if (!res.ok) throw new Error(`Failed to fetch proving key for ${circuit}`);
    return createProverKey(new Uint8Array(await res.arrayBuffer()));
  }

  async getVerifierKey(circuit: string): Promise<VerifierKey> {
    const res = await fetch(`/managed/hello-world/${circuit}.verifying-key`);
    if (!res.ok) throw new Error(`Failed to fetch verifying key for ${circuit}`);
    return createVerifierKey(new Uint8Array(await res.arrayBuffer()));
  }

  async getZKIR(circuit: string): Promise<ZKIR> {
    const res = await fetch(`/managed/hello-world/${circuit}.zkir`);
    if (!res.ok) throw new Error(`Failed to fetch ZKIR for ${circuit}`);
    return createZKIR(new Uint8Array(await res.arrayBuffer()));
  }
}

// Utility to hash passcode string to 32 bytes Uint8Array using SHA-256
async function hashPasscode(passcode: string): Promise<Uint8Array> {
  const msgBuffer = new TextEncoder().encode(passcode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return new Uint8Array(hashBuffer);
}

export default function App() {
  const [wallet, setWallet] = useState<any>(null);
  const [address, setAddress] = useState<string>('');
  const [tNightBalance, setTNightBalance] = useState<string>('0');
  const [dustBalance, setDustBalance] = useState<string>('0');
  const [connecting, setConnecting] = useState<boolean>(false);
  
  // Contract interaction state
  const [contractAddress, setContractAddress] = useState<string>(
    localStorage.getItem('contractAddress') || 'bf8064c08f02da8f168fe0c61833a5329e26b99ab466e8bbc2563711ed93169e'
  );
  const [messageInput, setMessageInput] = useState<string>('');
  const [passcodeInput, setPasscodeInput] = useState<string>('');
  const [proveInput, setProveInput] = useState<string>('');
  
  // Ledger state loaded from indexer
  const [ledgerMessage, setLedgerMessage] = useState<string>('');
  const [ledgerSecretHash, setLedgerSecretHash] = useState<string>('');
  
  // Status and logs
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Auto-detect wallet on mount
  useEffect(() => {
    refreshContractState();
  }, [contractAddress]);

  const refreshContractState = async () => {
    if (!contractAddress || contractAddress.length < 32) return;
    try {
      const publicDataProvider = indexerPublicDataProvider(
        'https://indexer.preprod.midnight.network/api/v4/graphql',
        'wss://indexer.preprod.midnight.network/api/v4/graphql/ws'
      );
      
      const state = await publicDataProvider.queryContractState(contractAddress);
      if (state) {
        const contractLedger = ledger(state.data);
        setLedgerMessage(contractLedger.message || 'No message set');
        setLedgerSecretHash(
          contractLedger.secretHash 
            ? Buffer.from(contractLedger.secretHash).toString('hex') 
            : 'No secret hash set'
        );
      }
    } catch (err: any) {
      console.error('Failed to load contract state:', err);
    }
  };

  const connectWallet = async () => {
    setConnecting(true);
    setError('');
    setStatus('Detecting wallets...');
    try {
      const midnight = (window as any).midnight;
      if (!midnight) {
        throw new Error('No Midnight DApp connector wallets found. Please install the Lace Beta browser extension.');
      }

      // Discover and select a wallet provider (e.g. Lace)
      const walletKeys = Object.keys(midnight);
      if (walletKeys.length === 0) {
        throw new Error('Lace wallet provider not injected. Please verify your extension settings.');
      }
      
      const provider = midnight[walletKeys[0]]; // select the first wallet (Lace)
      setStatus(`Connecting to ${provider.name || 'Lace wallet'}...`);
      
      const connectedApi = await provider.connect('preprod');
      setWallet(connectedApi);

      // Fetch wallet details
      const unshieldedAddr = await connectedApi.getUnshieldedAddress();
      setAddress(unshieldedAddr.unshieldedAddress);

      // Fetch balances
      const unshieldedBalances = await connectedApi.getUnshieldedBalances();
      const nightVal = unshieldedBalances[nativeToken().raw] || 0n;
      setTNightBalance((Number(nightVal) / 1_000_000).toFixed(2));

      const dustVal = await connectedApi.getDustBalance();
      setDustBalance((Number(dustVal.balance) / 1_000_000).toFixed(2));

      setStatus('Connected successfully!');
    } catch (err: any) {
      setError(err.message || String(err));
      setStatus('');
    } finally {
      setConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setWallet(null);
    setAddress('');
    setTNightBalance('0');
    setDustBalance('0');
    setStatus('Disconnected');
  };

  const handleDeployContract = async () => {
    setLoading(true);
    setError('');
    setStatus('Preparing contract deployment...');
    try {
      const providers = await getContractProviders();
      
      setStatus('Deploying contract on Preprod network (generating ZK proof)...');
      const deployed = await deployContract(providers, {
        compiledContract: compiledContract as any,
        args: [],
        privateStateId: 'helloWorldPrivateState',
        initialPrivateState: {},
      });
      
      const newAddress = deployed.deployTxData.public.contractAddress;
      setContractAddress(newAddress);
      localStorage.setItem('contractAddress', newAddress);
      
      setStatus(`Contract successfully deployed on Preprod! Address: ${newAddress}`);
      await refreshContractState();
    } catch (err: any) {
      setError(err.message || String(err));
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  // Helper to build contract providers using the connected wallet API
  const getContractProviders = async () => {
    if (!wallet) throw new Error('Wallet not connected');

    const addresses = await wallet.getShieldedAddresses();
    const zkConfigProvider = new BrowserZkConfigProvider();

    // Create the walletProvider interface
    const walletProvider = {
      getCoinPublicKey() {
        return addresses.shieldedCoinPublicKey;
      },
      getEncryptionPublicKey() {
        return addresses.shieldedEncryptionPublicKey;
      },
      async balanceTx(tx: any, ttl?: Date) {
        const serializedTx = Buffer.from(tx.serialize()).toString('hex');
        const result = await wallet.balanceUnsealedTransaction(serializedTx);
        const balancedTxBytes = Buffer.from(result.tx, 'hex');
        return Transaction.deserialize('signature', 'proof', 'binding', balancedTxBytes) as any;
      }
    };

    // Create the midnightProvider interface
    const midnightProvider = {
      async submitTx(tx: any) {
        const serializedTx = Buffer.from(tx.serialize()).toString('hex');
        await wallet.submitTransaction(serializedTx);
        return tx.transactionHash();
      }
    };

    return {
      privateStateProvider: levelPrivateStateProvider({
        accountId: address,
        privateStoragePasswordProvider: () => Promise.resolve('browser-passphrase-development-only-16chars'),
      }),
      publicDataProvider: indexerPublicDataProvider(
        'https://indexer.preprod.midnight.network/api/v4/graphql',
        'wss://indexer.preprod.midnight.network/api/v4/graphql/ws'
      ),
      zkConfigProvider: zkConfigProvider as any,
      proofProvider: httpClientProofProvider('http://localhost:6300', zkConfigProvider as any),
      walletProvider,
      midnightProvider,
    };
  };

  const handleStoreMessage = async () => {
    if (!messageInput.trim()) return;
    setLoading(true);
    setError('');
    setStatus('Preparing storeMessage transaction...');
    try {
      const providers = await getContractProviders();
      
      setStatus('Joining contract...');
      const contractInstance = await findDeployedContract(providers, {
        contractAddress,
        compiledContract: compiledContract as any,
        privateStateId: 'helloWorldPrivateState',
        initialPrivateState: {},
      });

      setStatus('Calling storeMessage circuit (generating ZK proof)...');
      const tx = await contractInstance.callTx.storeMessage(messageInput);
      
      setStatus('Transaction submitted successfully! Waiting for indexer sync...');
      await new Promise(r => setTimeout(r, 6000)); // wait for indexer to catch up
      await refreshContractState();
      setMessageInput('');
      setStatus('Message stored on-chain successfully!');
    } catch (err: any) {
      setError(err.message || String(err));
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  const handleSetSecretHash = async () => {
    if (!passcodeInput.trim()) return;
    setLoading(true);
    setError('');
    setStatus('Hashing passcode...');
    try {
      const hashedBytes = await hashPasscode(passcodeInput);
      const providers = await getContractProviders();

      setStatus('Joining contract...');
      const contractInstance = await findDeployedContract(providers, {
        contractAddress,
        compiledContract: compiledContract as any,
        privateStateId: 'helloWorldPrivateState',
        initialPrivateState: {},
      });

      setStatus('Calling setSecretHash circuit (generating ZK proof)...');
      const tx = await contractInstance.callTx.setSecretHash(hashedBytes);

      setStatus('Transaction submitted successfully! Waiting for indexer sync...');
      await new Promise(r => setTimeout(r, 6000));
      await refreshContractState();
      setPasscodeInput('');
      setStatus('Secret hash updated on-chain!');
    } catch (err: any) {
      setError(err.message || String(err));
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  const handleProveSecret = async () => {
    if (!proveInput.trim()) return;
    setLoading(true);
    setError('');
    setStatus('Hashing passcode input...');
    try {
      const hashedBytes = await hashPasscode(proveInput);
      const providers = await getContractProviders();

      setStatus('Joining contract...');
      const contractInstance = await findDeployedContract(providers, {
        contractAddress,
        compiledContract: compiledContract as any,
        privateStateId: 'helloWorldPrivateState',
        initialPrivateState: {},
      });

      setStatus('Calling verifySecret circuit (generating ZK proof client-side)...');
      // If the hash matches, the ZK constraint succeeds and transaction will build.
      // If not, proof generation fails, throwing an exception.
      const tx = await contractInstance.callTx.verifySecret(hashedBytes);

      setStatus('ZK Proof generated and verified on-chain! Passcode is correct!');
      setProveInput('');
    } catch (err: any) {
      setError(`ZK Verification Failed: The passcode is incorrect or the proof constraints failed. (${err.message || String(err)})`);
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header className="app-header">
        <div className="logo-section">
          <span className="logo-icon">🌙</span>
          <h1>Trustlance Escrow</h1>
        </div>
        <div className="connection-section">
          {wallet ? (
            <button className="btn btn-secondary disconnect" onClick={disconnectWallet}>
              Disconnect Wallet
            </button>
          ) : (
            <button className="btn btn-primary connect" onClick={connectWallet} disabled={connecting}>
              {connecting ? 'Connecting...' : 'Connect Lace Wallet'}
            </button>
          )}
        </div>
      </header>

      <main className="app-content">
        {error && <div className="alert alert-error">{error}</div>}
        {status && <div className="alert alert-status">{status}</div>}

        <div className="dashboard-grid">
          {/* Wallet State Panel */}
          <div className="panel wallet-panel">
            <h2>Wallet Details</h2>
            {wallet ? (
              <div className="details-list">
                <div className="detail-item">
                  <span className="label">Network</span>
                  <span className="value badge network-badge">Preprod</span>
                </div>
                <div className="detail-item">
                  <span className="label">Address</span>
                  <span className="value address-text" title={address}>{address}</span>
                </div>
                <div className="detail-item">
                  <span className="label">tNIGHT Balance</span>
                  <span className="value highlight">{tNightBalance} tNIGHT</span>
                </div>
                <div className="detail-item">
                  <span className="label">DUST Balance</span>
                  <span className="value highlight">{dustBalance} DUST</span>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>Please connect your Lace wallet to interact with the Midnight ledger.</p>
              </div>
            )}
          </div>

          {/* Contract State Panel */}
          <div className="panel contract-panel">
            <h2>Contract State</h2>
            <div className="form-group">
              <label>Contract Address</label>
              <input 
                type="text" 
                value={contractAddress} 
                onChange={(e) => setContractAddress(e.target.value)}
                placeholder="Enter deployed Preprod contract address..."
                className="input-text"
              />
            </div>
            <div className="details-list">
              <div className="detail-item">
                <span className="label">Public Message</span>
                <span className="value message-text">{ledgerMessage || 'Loading...'}</span>
              </div>
              <div className="detail-item">
                <span className="label">On-chain Secret Hash (SHA-256)</span>
                <span className="value hash-text" title={ledgerSecretHash}>{ledgerSecretHash || 'Loading...'}</span>
              </div>
            </div>
            <div className="button-group" style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-secondary refresh-btn" onClick={refreshContractState}>
                Refresh State
              </button>
              <button 
                className="btn btn-primary deploy-btn" 
                onClick={handleDeployContract}
                disabled={loading || !wallet}
              >
                Deploy New Contract
              </button>
            </div>
          </div>
        </div>

        {/* Interaction Panel */}
        <div className="panel actions-panel">
          <h2>Contract Interactions</h2>
          
          <div className="interaction-grid">
            {/* Store Public Message */}
            <div className="action-card">
              <h3>Store Public Message</h3>
              <p className="card-desc">Discloses a message to the ledger. Visible to all network participants.</p>
              <div className="form-group">
                <input 
                  type="text" 
                  value={messageInput} 
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Enter message to store..."
                  className="input-text"
                  disabled={loading || !wallet}
                />
              </div>
              <button 
                className="btn btn-primary action-btn" 
                onClick={handleStoreMessage}
                disabled={loading || !wallet || !messageInput.trim()}
              >
                Store Message
              </button>
            </div>

            {/* Set ZK Secret Hash */}
            <div className="action-card">
              <h3>Configure ZK Secret passcode</h3>
              <p className="card-desc">Saves the SHA-256 hash of a passcode to the ledger. The passcode remains hidden.</p>
              <div className="form-group">
                <input 
                  type="password" 
                  value={passcodeInput} 
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  placeholder="Enter secret passcode..."
                  className="input-text"
                  disabled={loading || !wallet}
                />
              </div>
              <button 
                className="btn btn-primary action-btn" 
                onClick={handleSetSecretHash}
                disabled={loading || !wallet || !passcodeInput.trim()}
              >
                Set Passcode Hash
              </button>
            </div>

            {/* Prove ZK Passcode Knowledge */}
            <div className="action-card highlight-card">
              <div className="badge private-badge">Zero Knowledge</div>
              <h3>Prove Passcode Knowledge</h3>
              <p className="card-desc">Generates a ZK proof client-side to prove knowledge of the passcode without disclosing it.</p>
              <div className="form-group">
                <input 
                  type="password" 
                  value={proveInput} 
                  onChange={(e) => setProveInput(e.target.value)}
                  placeholder="Verify passcode..."
                  className="input-text"
                  disabled={loading || !wallet}
                />
              </div>
              <button 
                className="btn btn-accent action-btn animate-pulse" 
                onClick={handleProveSecret}
                disabled={loading || !wallet || !proveInput.trim()}
              >
                Prove Passcode
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <p>Built on Midnight Preprod • ZK-Proof Selectively Disclosable Smart Contract</p>
      </footer>
    </div>
  );
}
