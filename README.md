<div align="center">

# 🕵️ O Impostor

**Jogo multiplayer de dedução social — direto no navegador.**

*"Um está entre vocês. Descubra quem antes que o tempo acabe."*

![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-F7DF1E?style=flat&logo=javascript&logoColor=000)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat&logo=firebase&logoColor=000)
![Tempo Real](https://img.shields.io/badge/Tempo_Real-22c55e?style=flat)
![Mobile Ready](https://img.shields.io/badge/Mobile-Ready-3b82f6?style=flat)

</div>

---

## 📖 Sobre

Inspirado em jogos de dedução social, **O Impostor** coloca todos os jogadores conversando sobre uma palavra secreta — menos o impostor, que precisa fingir que sabe do que estão falando. Conversem, façam perguntas, observem inconsistências, votem no suspeito.

### ✨ Destaques

- 🕵️ **3 a 10 jogadores** em tempo real
- 🎭 **Multi-impostor** opcional (1, 2 ou 3 infiltrados)
- 📚 **Múltiplas categorias** de palavras
- 🌗 **Modo palavra similar** — impostor recebe uma dica relacionada
- 🎨 **Tema Noir** com animações cinematográficas
- 🔊 **Sons procedurais** sem arquivos de áudio externos
- 💬 **Chat secreto** entre impostores no modo multi
- 📱 Roda no celular e no desktop

---

## 🚀 Configurar (em ~5 min)

### 1. Criar projeto no Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. **Criar projeto** → dê um nome → Next → Next
3. No menu lateral: **Build → Realtime Database → Criar banco de dados**
4. Escolha a localização (ex: `us-central1`) → **Iniciar no modo de teste** → Habilitar

### 2. Registrar o app web

1. Na tela inicial do projeto, clique no ícone **`</>`** (Web)
2. Dê um apelido (ex: `impostor`) → **Registrar app**
3. Copie os valores do objeto `firebaseConfig`

### 3. Preencher `firebase-config.js`

```js
const FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "meu-projeto.firebaseapp.com",
  databaseURL: "https://meu-projeto-default-rtdb.firebaseio.com",
  projectId: "meu-projeto",
  storageBucket: "meu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 4. Hospedar no GitHub Pages (grátis)

1. Suba os arquivos para um repositório no GitHub
2. **Settings → Pages → Source: Deploy from a branch → main → / (root)**
3. O link estará em `https://seu-usuario.github.io/nome-do-repo`

Compartilha com os amigos — abre direto no celular ou PC. ✨

---

## 🎮 Como jogar

|  Papel  | Recebe |
|:-------:|:-------|
| 🕵️ **Detetive** | A palavra secreta |
| 🎭 **Impostor** | Nada *(ou uma palavra similar, se ativado)* |

### Fluxo da partida

```
🚪 Lobby  →  🎴 Revelação  →  💬 Discussão  →  🗳️ Votação  →  🏆 Resultado
```

1. **Lobby** — host cria sala e compartilha o código de 4 letras
2. **Revelação** — cada jogador vê seu papel em segredo
3. **Discussão** — escrevam declarações sobre a palavra ou façam perguntas a outros jogadores
4. **Votação** — qualquer jogador pode chamar votação quando quiser
5. **Resultado** — vitória ou derrota, com animação e som

### 🏆 Condições de vitória

| Resultado da votação | Quem vence |
|:--|:--|
| 🎯 Eliminou o **impostor** | Detetives |
| ❌ Eliminou um **inocente** | Impostor |
| 🤝 Empate | Ninguém — chamem nova votação quando quiserem |

> 🚧 **Em desenvolvimento**: lógica de "continuar/parar a cada eliminação" para partidas mais longas com múltiplas rodadas.

---

## 🎯 Modo palavra similar

Quando ativado no lobby pelo host:

```
Detetives:   🏖️  Praia
Impostor:    🏊  Piscina
```

O impostor consegue dar dicas plausíveis sem revelar de cara que está perdido. **Bem mais difícil pros detetives.**

---

## 🛠️ Stack técnico

| Camada | Tecnologia |
|:--|:--|
| Frontend | Vanilla JavaScript, HTML, CSS |
| Tempo real | Firebase Realtime Database |
| Áudio | Web Audio API (sons sintetizados) |
| Hospedagem | GitHub Pages |
| Cores | CSS `oklch()` para palette perceptualmente uniforme |

---

## 📁 Estrutura

```
├── index.html              Entry point — todas as telas
├── style.css               Tema Noir + responsividade
├── firebase-config.js      ⚠️  Configurar antes de rodar
├── words.js                Categorias e pares de palavras
├── js/
│   ├── main.js             Listener Firebase + state machine
│   ├── lobby.js            Sala de espera
│   ├── game.js             Lógica da partida
│   ├── turns.js            Sistema de turnos
│   ├── voting.js           Sistema de votação
│   ├── results.js          Telas de fim de jogo (vitória/derrota)
│   ├── audio.js            Efeitos sonoros procedurais
│   ├── settings.js         Música e tema
│   ├── impostorchat.js     Chat secreto entre impostores
│   ├── auth.js             Autenticação opcional
│   ├── profile.js          Perfil do jogador
│   └── ...
├── backend/                Scripts de manutenção e validação
└── assets/                 Imagens e recursos
```

---

<div align="center">

**Feito com 🎩 e 🔍**

</div>
