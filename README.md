# Midnight App: Hello World & Privacy-First Escrow 🌙

Welcome to the New Moon Phase of the Midnight developer journey! This repository contains a compiled and deployed privacy-preserving smart contract on the official **Midnight Preview Network**.

- **Contract Address:** `a58cea2bc0774c5199569acde83f7acd024e2bedf482205d7ffc13aa334b5827`
- **Network:** `preview`
- **Deployer Wallet Address:** `mn_addr_preview1qv08enwu6lyrslfxy8aez4u6as6dnf0jqyaxhlkmc792wvcdyucqjjqtmr`

---

## 🏗️ Setup & Verification Instructions

To run, compile, deploy, and test this project, you must use a hybrid Windows/WSL2 configuration. Since compiling on Windows mounted drives mounted inside WSL (`/mnt/s/...`) causes permission/chmod errors, and Node on Windows can suffer from WebSocket connection drop/Normal Closure (code 1000) during transaction submission, we use the following workflow:

### Prerequisites
- Node.js (version 22+)
- Docker (with Compose v2+)
- Midnight `compact` compiler (version 0.31.1) and CLI (version 0.5.1) installed natively inside WSL Ubuntu.
- Node.js and npm installed natively inside WSL Ubuntu (`sudo apt-get install -y nodejs npm`).

### 1. Compile the Compact Smart Contract
The compiler runs inside WSL. The workspace script copies the contract files locally into WSL (`~/compact-temp`), compiles them natively, and copies the resulting `managed/` files back to the workspace.

To compile, run:
```bash
npm run compile
```

### 2. Run the Local Devnet (Optional)
If you want to test changes locally before deploying to Preview:
```bash
# Start local node, indexer, and proof-server
npm run proof-server:start

# Run E2E checks locally
npm run test:e2e
```

### 3. Deploy to the Public Preview Network
To deploy to the public Preview network:
```bash
# Deploys contract and automatically handles DUST token generation / registration
wsl -d Ubuntu bash -c "cd '/mnt/s/New moon midnight' && npm run deploy -- --network preview"
```

### 4. Run End-to-End Tests
To verify that the deployed contract is indexable and can be called on the Preview network:
```bash
wsl -d Ubuntu bash -c "cd '/mnt/s/New moon midnight' && npm run test:e2e -- --network preview"
```

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
