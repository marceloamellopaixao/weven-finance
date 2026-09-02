export const accountProfile = {
  metadata: {
    title: "WevenFinance | Perfil da conta",
    description: "Escolha o perfil de uso para preparar categorias, relatórios e atalhos iniciais no WevenFinance.",
  },
  badge: "Selecione seu perfil de uso para começarmos!",
  title: "Como você quer organizar o WevenFinance?",
  description: "Vamos preparar categorias, relatórios e atalhos para o jeito que você usa dinheiro no dia a dia.",
  greeting: "Olá, {name}. Escolha uma opção para continuar.",
  selected: "Selecionado",
  choose: "Escolher",
  notice: "Você poderá criar outros perfis depois. Este será usado como padrão para relatórios mensais e categorias iniciais.",
  preparing: "Preparando...",
  createError: "Não foi possível criar o perfil da conta",
  options: {
    personal: {
      title: "Perfil pessoal",
      description: "Controle salário, gastos, cartões, metas, dívidas e limite diário inteligente.",
    },
    professional: {
      title: "Business/PJ",
      description: "Use para MEI, CNPJ, igreja, loja, autônomo, prestação de serviço ou projeto profissional.",
    },
    church: {
      title: "Business/PJ",
      description: "Igrejas, ministérios e projetos profissionais entram no perfil Business/PJ.",
    },
    family: {
      title: "Perfil família / casa",
      description: "Controle contas compartilhadas, mercado, aluguel, escola, transporte e metas familiares.",
    },
    business: {
      title: "Business/PJ",
      description: "Controle receitas, despesas, impostos, fornecedores, fluxo de caixa e relatórios do negócio.",
    },
  },
} as const;
