# WevenFinance 💰

**Gerenciamento financeiro pessoal com foco em UX/UI premium e liberdade financeira.**

---

## 📖 Sobre o Projeto

**WevenFinance** é uma aplicação web moderna estilo *Fintech*, desenvolvida para quem busca clareza total sobre suas finanças.  
O projeto vai além do básico, permitindo controle completo do fluxo de caixa, gestão inteligente de parcelamentos e visualização estratégica de vencimentos — tudo envolto em uma interface limpa, responsiva e focada em experiência do usuário.

---

## 🚀 Funcionalidades Principais

### 📊 Gestão Financeira Completa

- **Dashboard Interativo**  
  Visão consolidada de saldo atual, contas a pagar no mês e projeção de fechamento.

- **Fluxo de Caixa Visual**  
  Gráficos de área interativos (*Recharts*) para acompanhar a evolução dos gastos.

- **Navegação Temporal**  
  Filtro mensal dinâmico para navegar entre meses com lançamentos registrados.

---

### 💳 Controle Avançado de Despesas

- **Datas Inteligentes**  
  Diferenciação entre **Data da Compra** e **Data de Vencimento** (essencial para cartões de crédito).

- **Gestão de Parcelamentos (Recorrência)**  
  - Lançamento automático de parcelas futuras (ex: `1/12`, `2/12`, `3/12`...).  
  - **Edição em Lote**: Atualize valores ou descrições de todas as parcelas de uma vez.  
  - **Exclusão Inteligente**: Delete uma parcela específica ou o carnê inteiro.

- **Check-in Financeiro**  
  Marcação rápida de status (**Pago / Pendente**) com feedback visual imediato.

- **Alertas de Vencimento**  
  Indicadores visuais para contas atrasadas ou vencendo no dia.

---

### 🎨 UI/UX Premium

- **Mobile First**  
  Layout totalmente adaptável para celulares e desktops.

- **Componentes de Elite**  
  Construído com **shadcn/ui** e **Radix UI**, garantindo acessibilidade e design refinado.

- **Feedback Rico**  
  Modais responsivos, animações suaves e transições de página (*Framer Motion style*).

---

## 🔮 Roadmap & Ideias Futuras

O projeto está em constante evolução.  
Principal funcionalidade planejada para as próximas versões:

### 🔄 Rolagem de Saldo Inteligente (Rollover)

> Isolar o saldo por mês. Caso sobre um valor positivo ao final do mês, ele será transferido automaticamente como **Saldo Inicial** para o mês seguinte.

- [ ] Implementar lógica de fechamento de mês  
- [ ] Criar campo de **Saldo Anterior** no Dashboard  
- [ ] Visualização de economia acumulada ao longo do ano  

---

## 🛠️ Stack Tecnológica

A arquitetura segue princípios de **Clean Code** e **separação de responsabilidades**.

| Categoria        | Tecnologia                         |
|------------------|------------------------------------|
| Framework        | Next.js 14 (App Router)             |
| Linguagem        | TypeScript (Strict Mode)            |
| Estilização      | Tailwind CSS                        |
| Componentes      | shadcn/ui + Radix UI                |
| Ícones           | Lucide React                        |
| Gráficos         | Recharts                            |
| Backend & DB     | Firebase (Auth + Firestore)         |

---

## 📂 Estrutura de Pastas

```text
src/
├── app/               # Rotas (Next.js App Router)
│   ├── (auth)/        # Login, Registro, Recuperação
│   ├── (dashboard)/   # Área logada (Protegida)
│   └── layout.tsx     # Root Layout com Providers
├── components/
│   ├── charts/        # Gráficos isolados
│   └── ui/            # Componentes reutilizáveis (Button, Card, Input...)
├── hooks/             # Custom Hooks (useAuth, useTransactions)
├── services/          # Camada de comunicação com Firebase
└── types/             # Definições de Tipos (DTOs, Interfaces)
```

---

## ⚙️ Configuração e Instalação

Siga os passos abaixo para rodar o projeto localmente.

### Pré-requisitos

* Node.js **v18+**
* Conta no **Firebase Console**

---

### Passo a Passo

**Clone o repositório:**

```bash
git clone https://github.com/marceloamellopaixao/weven-finance.git
cd weven-finance
```

**Instale as dependências:**

```bash
npm install
# ou
yarn install
```

**Configure as variáveis de ambiente:**

Crie um arquivo `.env.local` na raiz do projeto e adicione:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=sua_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=seu_app_id
```

**Execute o projeto:**

```bash
npm run dev
```

**Acesse:**
Abra [http://localhost:3000](http://localhost:3000) no navegador.

---

## 👨‍💻 Autor

Desenvolvido com 💜 por **Marcelo Augusto de Mello Paixão**.

<p align="center">
  <i>Um produto <strong>Weven Tech</strong> — Soluções inteligentes para gestão financeira.</i>
</p>