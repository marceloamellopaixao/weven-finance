# Weven Finance 💰

# IDEIA

<p>FAZER COM QUE O SALDO DISPONÍVEL SEJA DO MÊS, CASO SOBRAR O VALOR COMO POSITIVO, IR PARA O MÊS SEGUINTE</p>

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Firebase](https://img.shields.io/badge/Firebase-Assas-orange)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC)
![Status](https://img.shields.io/badge/Status-Em_Desenvolvimento-yellow)

**Weven Finance** é uma aplicação web moderna de gestão financeira pessoal, desenvolvida com foco em UX/UI premium (estilo Fintech). O projeto permite controle total de fluxo de caixa, gestão inteligente de parcelamentos e visualização clara de vencimentos.

## 🚀 Funcionalidades Principais

### 📊 Gestão Financeira
- **Dashboard Interativo:** Visão geral de saldo atual, contas a pagar no mês e saldo projetado.
- **Fluxo de Caixa:** Gráfico de área (Recharts) mostrando a evolução dos gastos por vencimento.
- **Filtro Mensal Dinâmico:** Navegação inteligente entre meses que possuem lançamentos.

### 💳 Controle de Despesas Avançado
- **Diferenciação de Datas:** Controle separado para "Data da Compra" e "Data de Vencimento" (essencial para cartões de crédito).
- **Gestão de Parcelamentos:**
  - Criação automática de lançamentos futuros (ex: 1/12, 2/12...).
  - **Edição em Grupo:** Ao alterar o valor ou nome de uma parcela, o sistema oferece atualizar toda a série automaticamente.
  - **Exclusão Inteligente:** Opção de deletar apenas uma parcela ou o carnê inteiro.
- **Status de Pagamento:** Checkbox rápido para marcar como pago/pendente.
- **Alertas Visuais:** Indicação visual (vermelho) para contas vencidas.

### 🎨 UI/UX Premium
- **Design Responsivo:** Layout adaptável (Mobile First) usando Grid e Flexbox.
- **Componentes Modernos:** Construído com `shadcn/ui` para acessibilidade e beleza.
- **Feedback Visual:** Modais responsivos, Toasts (opcional) e transições suaves.

---

## 🛠️ Stack Tecnológica

O projeto foi construído utilizando as melhores práticas de desenvolvimento web atual:

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
- **Linguagem:** [TypeScript](https://www.typescriptlang.org/) (Tipagem estrita, sem `any`)
- **Estilização:** [Tailwind CSS](https://tailwindcss.com/)
- **Componentes:** [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/)
- **Ícones:** [Lucide React](https://lucide.dev/)
- **Gráficos:** [Recharts](https://recharts.org/)
- **Backend & Database:** [Firebase](https://firebase.google.com/) (Auth + Firestore)

---

## 📂 Estrutura do Projeto

A arquitetura segue princípios de Clean Code e separação de responsabilidades:

```bash
src/
├── app/
│   ├── (auth)/         # Rotas de Autenticação (Login)
│   ├── (dashboard)/    # Aplicação Principal (Protegida)
│   └── layout.tsx      # Layout Root com Providers
├── components/
│   ├── charts/         # Componentes de Gráficos
│   └── ui/             # Componentes Base (Button, Card, Input...)
├── hooks/              # Custom Hooks (useAuth, useTransactions)
├── services/           # Lógica de Negócio e Comunicação com Firebase
└── types/              # Definições de Tipos TypeScript (DTOs, Interfaces)
````

-----

## ⚙️ Configuração e Instalação

### Pré-requisitos

  - Node.js (v18+)
  - Conta no Google Firebase

### Passo a Passo

1.  **Clone o repositório:**

    ```bash
    git clone https://github.com/marceloamellopaixao/weven-finance.git
    cd weven-finance
    ```

2.  **Instale as dependências:**

    ```bash
    npm install
    # ou
    yarn install
    ```

3.  **Configure as Variáveis de Ambiente:**
    Crie um arquivo `.env.local` na raiz do projeto e adicione suas credenciais do Firebase:

    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY=sua_api_key
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu_project_id
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu_bucket
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
    NEXT_PUBLIC_FIREBASE_APP_ID=seu_app_id
    ```

4.  **Execute o projeto:**

    ```bash
    npm run dev
    ```

5.  **Acesse:** Abra `http://localhost:3000` no seu navegador.

-----

## 🔒 Regras de Segurança (Firestore)

Para garantir a privacidade dos dados, utilize as seguintes regras no seu Console do Firebase:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/{document=**} {
      allow read, write: if isOwner(userId);
    }
  }
}
```

-----

## 👨‍💻 Autor

Desenvolvido por **Marcelo Augusto de Mello Paixão**.

-----

*Este projeto é para fins de estudo e uso pessoal de gestão financeira.*