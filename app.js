// ====================================================================
// app.js - FINAL COM WHATSAPP, PAGAMENTO E NÚMERO SEQUENCIAL
// ====================================================================

// 1. CONFIGURAÇÃO SUPABASE
const SUPABASE_URL = 'https://xhjvlpisuejqrgsjmidj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoanZscGlzdWVqcXJnc2ptaWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NTkzMzUsImV4cCI6MjA3NTEzNTMzNX0.VaL4yMqj019s-hHrL6KlBW-q2OMMt-q90QXiGiAMrh4';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let shoppingCart = [];

// ====================================================================
// 2. FUNÇÕES DE SUPORTE
// ====================================================================

function getDiaDaSemana() {
    const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const data = new Date();
    return dias[data.getDay()];
}

function formatPrice(price) {
    return price.toFixed(2).replace('.', ',');
}

// ====================================================================
// 3. LÓGICA DO CARRINHO (Mantida)
// ====================================================================

function renderCart() {
    const list = document.getElementById('cart-items-list');
    const totalElement = document.getElementById('cart-total');
    const countElement = document.getElementById('cart-count');

    let total = 0;

    if (shoppingCart.length === 0) {
        list.innerHTML = '<p>Seu carrinho está vazio.</p>';
        totalElement.textContent = '0,00';

        // ⚠️ CORREÇÃO: O BOTÃO FLUTUANTE FICA SEMPRE VISÍVEL
        document.getElementById('view-cart-btn').style.display = 'block';
        countElement.textContent = '0';

        return;
    }

    // Se houver itens, ele já está visível
    document.getElementById('view-cart-btn').style.display = 'block';

    list.innerHTML = shoppingCart.map((item, index) => {
        const itemTotal = item.preco * item.quantidade;
        total += itemTotal;
        return `
            <div style="border-bottom: 1px solid #fff; padding: 5px 0;">
                <strong>${item.nome}</strong> (${item.quantidade}x)
                <span style="float: right;">R$ ${formatPrice(itemTotal)}</span>
                <br>
                <button style="margin-right: 5px;" onclick="updateCartQuantity(${index}, 1)">+</button>
                <button onclick="updateCartQuantity(${index}, -1)">-</button>
            </div>
        `;
    }).join('');

    totalElement.textContent = formatPrice(total);
    const totalItems = shoppingCart.reduce((sum, item) => sum + item.quantidade, 0);
    countElement.textContent = totalItems;
}

function addToCart(nome, preco, is_substituicao, itemId) {
    const existingItemIndex = shoppingCart.findIndex(item => item.itemId === itemId);

    if (existingItemIndex > -1) {
        shoppingCart[existingItemIndex].quantidade += 1;
    } else {
        shoppingCart.push({
            itemId: itemId,
            nome: nome,
            preco: preco,
            quantidade: 1,
            is_substituicao: is_substituicao,
            observacoes: null
        });
    }

    renderCart();
}

function updateCartQuantity(index, delta) {
    shoppingCart[index].quantidade += delta;

    if (shoppingCart[index].quantidade <= 0) {
        shoppingCart.splice(index, 1);
    }

    renderCart();
}

// ====================================================================
// 4. FUNÇÕES DE CONSULTA (QUERIES) - CARREGAMENTO DO CARDÁPIO (Mantida)
// ====================================================================

async function fetchPratoDoDia() {
    const diaAtual = getDiaDaSemana();
    document.getElementById('dia-semana').textContent = diaAtual;

    if (diaAtual === 'Sábado' || diaAtual === 'Domingo') {
        document.getElementById('prato-principal').innerHTML =
            '<p>Desculpe, o cardápio da semana não está disponível hoje. Por favor, consulte Lanches e Bebidas.</p>';
        return;
    }

    const { data, error } = await supabase
        .from('cardapio_semanal')
        .select('*')
        .eq('dia_da_semana', diaAtual)
        .single();

    const container = document.getElementById('prato-principal');
    if (error) {
        container.textContent = 'Erro ao carregar o prato do dia. Verifique o RLS para cardapio_semanal.';
        return;
    }

    if (data) {
        const pratoID = `prato_${data.dia_da_semana}`;
        const comboID = `combo_${data.dia_da_semana}`;

        container.innerHTML = `
            <h3>${data.prato_principal}</h3>
            <p>${data.acompanhamentos}</p>
            
            <div class="item">
                <div class="item-info">
                    <span class="price">R$ ${formatPrice(data.preco_prato)}</span>
                    Opção: O Prato
                </div>
                <button onclick="addToCart('Prato do Dia: ${data.prato_principal} (Prato)', ${data.preco_prato}, false, '${pratoID}')">+</button>
            </div>
            
            <div class="item">
                <div class="item-info">
                    <span class="price">R$ ${formatPrice(data.preco_combo)}</span>
                    Opção: Combo (Prato + Coca 300ml)
                </div>
                <button onclick="addToCart('Prato do Dia: ${data.prato_principal} (Combo)', ${data.preco_combo}, false, '${comboID}')">+</button>
            </div>
            <p style="margin-top: 15px; font-size: 0.9em;">*Opções de substituição disponíveis.</p>
        `;
    }
}

async function fetchItensFixos(categoria, elementoId) {
    const { data, error } = await supabase
        .from('produtos_fixos')
        .select('id, nome, preco, descricao')
        .eq('categoria', categoria);

    const container = document.getElementById(elementoId);

    if (error) {
        let errorMessage = `Erro ao carregar ${categoria}. Verifique o RLS ou os valores da coluna 'categoria' na tabela produtos_fixos.`;
        if (error.code === '400') {
            errorMessage = `Erro de filtro (400 Bad Request) para "${categoria}". Verifique se o valor no banco de dados está EXATAMENTE igual (sem espaços ou erros de digitação).`;
        }
        container.textContent = errorMessage;
        console.error(`Erro na query para ${categoria}:`, error);
        return;
    }

    if (data && data.length > 0) {
        container.innerHTML = data.map(item => `
            <div class="item">
                <div class="item-info">
                    <span class="price">R$ ${formatPrice(item.preco)}</span>
                    ${item.nome}
                    ${item.descricao ? `<small> - ${item.descricao}</small>` : ''}
                </div>
                <button onclick="addToCart('${item.nome}', ${item.preco}, false, '${item.id}')">+</button>
            </div>
        `).join('');
    } else {
        container.textContent = `Nenhum item encontrado na categoria ${categoria}.`;
    }
}

// ====================================================================
// 5. LÓGICA DE AUTENTICAÇÃO (Mantida)
// ====================================================================

function showForm(formType) {
    document.getElementById('login-form').style.display = formType === 'login' ? 'block' : 'none';
    document.getElementById('signup-form').style.display = formType === 'signup' ? 'block' : 'none';
}

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        alert('Erro no Login: ' + error.message);
    } else {
        checkUserSession();
    }
}

async function handleSignUp(event) {
    event.preventDefault();
    const name = document.getElementById('signup-name').value;
    const phone = document.getElementById('signup-phone').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

    if (authError) {
        alert('Erro no Cadastro: ' + authError.message);
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        const { error: dbError } = await supabase.from('clientes').insert({
            id: user.id,
            nome: name,
            telefone: phone,
            email: email
        });

        if (dbError) {
            console.error('Falha ao salvar o perfil (401/42501):', dbError);
            alert('Erro ao salvar nome/telefone no banco de dados. Verifique o RLS!');
            await supabase.auth.signOut();
        } else {
            alert('Cadastro realizado com sucesso! Você está logado.');
            checkUserSession();
        }
    } else {
        alert('Cadastro criado, mas a sessão falhou ao carregar. Tente fazer login.');
    }
}

async function handleLogout() {
    await supabase.auth.signOut();
    checkUserSession();
}

async function checkUserSession() {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        document.getElementById('auth-forms').style.display = 'none';
        document.getElementById('menu-app').style.display = 'block';
        document.getElementById('logout-btn').style.display = 'block';
        initMenuLoad();
    } else {
        document.getElementById('auth-forms').style.display = 'block';
        document.getElementById('menu-app').style.display = 'none';
        document.getElementById('logout-btn').style.display = 'none';
        document.getElementById('cart-sidebar').style.display = 'none';
    }
}


// ====================================================================
// 6. FUNÇÃO FINALIZAR PEDIDO (CHECKOUT) - COM NÚMERO SEQUENCIAL
// ====================================================================

async function handleCheckout() {
    if (shoppingCart.length === 0) {
        alert("O carrinho está vazio! Adicione itens antes de finalizar.");
        return;
    }

    // --- 1. CAPTURAR MÉTODO DE PAGAMENTO E TROCO ---
    const metodoPagamento = document.getElementById('payment-method').value;
    if (!metodoPagamento) {
        alert("Por favor, selecione a forma de pagamento.");
        return;
    }

    let observacaoTroco = '';
    let trocoNecessario = 0;
    if (metodoPagamento === 'Dinheiro') {
        const trocoValor = document.getElementById('troco-input').value;
        if (trocoValor) {
            trocoNecessario = parseFloat(trocoValor);
            observacaoTroco = ` (Troco para R$ ${formatPrice(trocoNecessario)})`;
        }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert("Você precisa estar logado para finalizar o pedido.");
        return;
    }

    const valorTotal = shoppingCart.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
    const metodoDB = metodoPagamento + observacaoTroco;


    // --- 2. BUSCAR DADOS DO CLIENTE ---
    const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('nome, telefone')
        .eq('id', user.id)
        .single();

    if (clienteError || !clienteData) {
        alert("Erro: Não foi possível carregar os dados do seu perfil para o pedido.");
        return;
    }
    const clienteNome = clienteData.nome;
    const clienteTelefone = clienteData.telefone;


    // --- 3. INSERIR NA TABELA 'PEDIDOS' (Registro no DB) ---
    // ⚠️ ALTERADO: Agora solicitamos o 'numero_sequencial' de volta.
    const { data: pedidoData, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
            cliente_id: user.id,
            valor_total: valorTotal,
            status: 'Pendente',
            metodo_pagamento: metodoDB
        })
        .select('id, numero_sequencial') // PEDIMOS O NOVO CAMPO
        .single();

    if (pedidoError) {
        console.error('Erro ao criar o pedido:', pedidoError);
        alert('Falha ao registrar o pedido. Verifique o RLS para a tabela "pedidos" e a configuração do SEQUENCE no Supabase!');
        return;
    }

    const pedidoId = pedidoData.id;
    // FORMATAÇÃO DO NÚMERO SEQUENCIAL (ex: 1 -> "01", 10 -> "10")
    const numeroSequencial = pedidoData.numero_sequencial.toString().padStart(2, '0');


    // --- 4. PREPARAR E INSERIR EM 'ITENS_PEDIDO' ---
    const itensPedidoParaInserir = shoppingCart.map(item => ({
        pedido_id: pedidoId,
        nome_item: item.nome,
        quantidade: item.quantidade,
        preco_unitario: item.preco,
        is_substituicao: item.is_substituicao,
        observacoes: item.observacoes
    }));

    const { error: itensError } = await supabase
        .from('itens_pedido')
        .insert(itensPedidoParaInserir);

    if (itensError) {
        console.error('Erro ao inserir itens do pedido:', itensError);
        alert('O pedido foi criado, mas houve falha ao registrar os itens. Contate o suporte.');
        return;
    }

    // --- 5. MONTAGEM E ENVIO DA MENSAGEM PARA WHATSAPP ---
    const NUMERO_CANTINA = '5511914644275';

    let mensagem = `*🚨 NOVO PEDIDO (CANTINA)*\n\n`;
    // ⚠️ ALTERADO: Agora mostra o número sequencial!
    mensagem += `*Pedido: ${numeroSequencial}*\n`;
    mensagem += `Cliente: ${clienteNome}\n`;
    mensagem += `Telefone: ${clienteTelefone}\n\n`;
    mensagem += `*🧾 ITENS DO PEDIDO:*\n`;

    shoppingCart.forEach(item => {
        mensagem += `• ${item.quantidade}x ${item.nome} (R$ ${formatPrice(item.preco * item.quantidade)})\n`;
    });

    mensagem += `\n*TOTAL: R$ ${formatPrice(valorTotal)}*\n`;
    mensagem += `*PAGAMENTO:* ${metodoDB}`;

    const urlWhatsapp = `https://wa.me/${NUMERO_CANTINA}?text=${encodeURIComponent(mensagem)}`;

    // 6. SUCESSO E LIMPEZA
    shoppingCart = [];
    renderCart();
    document.getElementById('cart-sidebar').style.display = 'none';

    // ⚠️ ALTERADO: Agora o alerta mostra o número sequencial
    alert(`Pedido Nº ${numeroSequencial} registrado! Finalize o envio da mensagem no WhatsApp.`);
    window.open(urlWhatsapp, '_blank');
}


// ====================================================================
// 7. INICIALIZAÇÃO
// ====================================================================

async function initMenuLoad() {
    await fetchPratoDoDia();
    await fetchItensFixos('Lanche', 'lanches-lista');
    await fetchItensFixos('Bebida', 'bebidas-lista');
    renderCart();
}

document.addEventListener('DOMContentLoaded', () => {
    // Listener para o campo de Troco
    const paymentMethodSelect = document.getElementById('payment-method');
    const trocoInput = document.getElementById('troco-input');

    if (paymentMethodSelect && trocoInput) {
        paymentMethodSelect.addEventListener('change', (event) => {
            const isDinheiro = event.target.value === 'Dinheiro';
            trocoInput.style.display = isDinheiro ? 'block' : 'none';
            trocoInput.value = ''; // Limpa ao trocar o método
        });
    }

    // Listeners de Autenticação
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('signup-form').addEventListener('submit', handleSignUp);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Listeners do Carrinho e Checkout
    document.getElementById('view-cart-btn').addEventListener('click', () => {
        document.getElementById('cart-sidebar').style.display = 'block';
    });
    document.getElementById('close-cart-btn').addEventListener('click', () => {
        document.getElementById('cart-sidebar').style.display = 'none';
    });
    document.getElementById('checkout-btn').addEventListener('click', handleCheckout);

    checkUserSession();
});