# Midnight App: Hello World & Privacy-First Escrow 🌙

Welcome to the New Moon Phase of the Midnight developer journey! This repository contains a compiled and deployed privacy-preserving smart contract on the official **Midnight Preview Network**.

- **Contract Address:** `a58cea2bc0774c5199569acde83f7acd024e2bedf482205d7ffc13aa334b5827`
- **Network:** `preview`
- **Deployer Wallet Address:** `mn_addr_preview1qv08enwu6lyrslfxy8aez4u6as6dnf0jqyaxhlkmc792wvcdyucqjjqtmr`

---

## 🏗️ Step-by-Step Running Instructions

Follow these commands in sequence to set up, compile, deploy, and interact with the contract on the public **Preview** network:

### Prerequisites
- Node.js (version 22+)
- Docker (with Compose v2+ for local development)
- Midnight `compact` compiler (version 0.31.1) and CLI (version 0.5.1) installed inside WSL Ubuntu.
- Node.js and npm installed inside WSL Ubuntu (`sudo apt-get install -y nodejs npm`).

### 1. Install Dependencies
Run this on your host machine (Windows PowerShell) to install Node packages:
```bash
npm install
```

### 2. Compile the Smart Contract
Compiles the `hello-world.compact` contract to its WebAssembly and TypeScript definitions (runs natively in WSL to avoid Windows file permission errors):
```bash
npm run compile
```

### 3. Check Wallet Balance
Check the `tNIGHT` and `tDUST` balances of the Preview address:
```bash
npx tsx src/check-balance.ts --network preview
```

### 4. Deploy the Contract
Deploy the contract to the Preview network. This generates and registers DUST tokens, generates zero-knowledge proofs, and deploys the contract (runs natively in WSL to avoid Windows socket disconnects):
```bash
wsl -d Ubuntu bash -c "cd '/mnt/s/New moon midnight' && npm run deploy -- --network preview"
```

### 5. Run Verification Tests
Verify the deployment with E2E smoke tests on the Preview network (runs in WSL):
```bash
wsl -d Ubuntu bash -c "cd '/mnt/s/New moon midnight' && npm run test:e2e -- --network preview"
```

### 6. Interact using the CLI
Run the interactive console menu to read/store values on the deployed contract:
```bash
npx tsx src/cli.ts --network preview
```
*(Note: If you see transient `Wallet.Sync` error messages while idle in the CLI, these are normal keepalive disconnections from the public nodes. You can type any choice and press Enter to automatically reconnect.)*

---

## 🔒 Public State vs. Private Witness in Midnight

Midnight Network separates state into two distinct spaces: **Public Ledger State** and **Private Witness State** (managed by the Compact language).

1. **Public State:**
   - **What it is:** The global, on-chain state stored directly on the ledger.
   - **Access:** Visible to everyone on the network and verified by all consensus nodes.
   - **Use Case:** Used for contract metadata, public balances, progress counters, or flags that need to be globally agreed upon.

2. **Private Witness State:**
   - **What it is:** State and inputs kept locally on the user's machine (client-side).
   - **Access:** Only readable by the participant (or authorized parties) and never broadcast to the network.
   - **How it works:** When a transaction is made, the local **Proof Server** executes the contract logic on the private witness state and generates a Zero-Knowledge Proof (ZKP). Only the ZKP and public state updates are sent to the blockchain. Consensus nodes verify the proof to ensure the state transition is valid, without learning the private witness values.

---

## 💡 Initial Product Idea: Trustlance Escrow 🤝

**Trustlance Escrow** is a privacy-preserving milestone-based escrow smart contract for decentralized freelance engagements. Rather than publishing contract parameters, payout values, and specific milestone requirements on-chain, Trustlance hides these details in the private witness state. Freelancers and clients lock milestone definitions and payment amounts locally. When a milestone is completed, the freelancer generates a zero-knowledge proof proving completion of the milestone according to the pre-agreed terms, which unlocks the payment. On-chain, only cryptographic commitment hashes and progress status flags are visible, protecting the financial privacy and intellectual property of both parties while keeping the escrow agreement mathematically secure.
