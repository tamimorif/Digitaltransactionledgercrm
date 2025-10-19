import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const app = new Hono();

app.use('*', cors());
app.use('*', logger(console.log));

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Utility function to generate unique IDs
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ===========================
// CLIENT ROUTES
// ===========================

// Get all clients (for search)
app.get('/make-server-a3e538f5/clients', async (c) => {
  try {
    const clientKeys = await kv.getByPrefix('client:');
    const clients = clientKeys
      .map(item => item.value)
      .filter(client => client && client.id && client.phoneNumber && client.name);
    return c.json({ success: true, clients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get client by ID
app.get('/make-server-a3e538f5/clients/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const client = await kv.get(`client:${id}`);
    
    if (!client) {
      return c.json({ success: false, error: 'Client not found' }, 404);
    }
    
    return c.json({ success: true, client });
  } catch (error) {
    console.error('Error fetching client:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Create new client
app.post('/make-server-a3e538f5/clients', async (c) => {
  try {
    const body = await c.req.json();
    const { name, phoneNumber, email } = body;
    
    if (!name || !phoneNumber) {
      return c.json({ success: false, error: 'Name and phone number are required' }, 400);
    }
    
    // Check if phone number already exists
    const existingClients = await kv.getByPrefix('client:');
    const duplicate = existingClients.find(item => 
      item && item.value && item.value.phoneNumber === phoneNumber
    );
    
    if (duplicate) {
      return c.json({ success: false, error: 'Phone number already exists', client: duplicate.value }, 409);
    }
    
    const clientId = generateId('client');
    const client = {
      id: clientId,
      name,
      phoneNumber,
      email: email || '',
      joinDate: new Date().toISOString(),
    };
    
    await kv.set(`client:${clientId}`, client);
    
    return c.json({ success: true, client }, 201);
  } catch (error) {
    console.error('Error creating client:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Update client
app.put('/make-server-a3e538f5/clients/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { name, phoneNumber, email } = body;
    
    const existingClient = await kv.get(`client:${id}`);
    if (!existingClient) {
      return c.json({ success: false, error: 'Client not found' }, 404);
    }
    
    const updatedClient = {
      ...existingClient,
      name: name || existingClient.name,
      phoneNumber: phoneNumber || existingClient.phoneNumber,
      email: email !== undefined ? email : existingClient.email,
    };
    
    await kv.set(`client:${id}`, updatedClient);
    
    return c.json({ success: true, client: updatedClient });
  } catch (error) {
    console.error('Error updating client:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ===========================
// TRANSACTION ROUTES
// ===========================

// Get all transactions for a client
app.get('/make-server-a3e538f5/clients/:clientId/transactions', async (c) => {
  try {
    const clientId = c.req.param('clientId');
    
    // Get all transactions and filter by clientId
    const allTransactions = await kv.getByPrefix('transaction:');
    const clientTransactions = allTransactions
      .map(item => item.value)
      .filter(tx => tx && tx.clientId === clientId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return c.json({ success: true, transactions: clientTransactions });
  } catch (error) {
    console.error('Error fetching client transactions:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get all transactions (for reporting)
app.get('/make-server-a3e538f5/transactions', async (c) => {
  try {
    const allTransactions = await kv.getByPrefix('transaction:');
    const transactions = allTransactions
      .map(item => item.value)
      .filter(tx => tx && tx.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return c.json({ success: true, transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Create new transaction
app.post('/make-server-a3e538f5/transactions', async (c) => {
  try {
    const body = await c.req.json();
    const {
      clientId,
      type,
      sendCurrency,
      sendAmount,
      receiveCurrency,
      receiveAmount,
      rateApplied,
      feeCharged,
      beneficiaryName,
      beneficiaryDetails,
      userNotes,
    } = body;
    
    // Validate required fields
    if (!clientId || !type || !sendCurrency || !sendAmount || !receiveCurrency || !receiveAmount || rateApplied === undefined || feeCharged === undefined) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }
    
    // Validate bank transfer specific fields
    if (type === 'BANK_TRANSFER' && !beneficiaryDetails) {
      return c.json({ success: false, error: 'Beneficiary details (IBAN/Card) are required for bank transfers' }, 400);
    }
    
    // Verify client exists
    const client = await kv.get(`client:${clientId}`);
    if (!client) {
      return c.json({ success: false, error: 'Client not found' }, 404);
    }
    
    const transactionId = generateId('tx');
    const transaction = {
      transactionId,
      clientId,
      date: new Date().toISOString(),
      type,
      sendCurrency,
      sendAmount: Number(sendAmount),
      receiveCurrency,
      receiveAmount: Number(receiveAmount),
      rateApplied: Number(rateApplied),
      feeCharged: Number(feeCharged),
      beneficiaryName: beneficiaryName || '',
      beneficiaryDetails: beneficiaryDetails || '',
      userNotes: userNotes || '',
    };
    
    await kv.set(`transaction:${transactionId}`, transaction);
    
    return c.json({ success: true, transaction }, 201);
  } catch (error) {
    console.error('Error creating transaction:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get single transaction
app.get('/make-server-a3e538f5/transactions/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const transaction = await kv.get(`transaction:${id}`);
    
    if (!transaction) {
      return c.json({ success: false, error: 'Transaction not found' }, 404);
    }
    
    return c.json({ success: true, transaction });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Update transaction (with edit history)
app.put('/make-server-a3e538f5/transactions/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const {
      type,
      sendCurrency,
      sendAmount,
      receiveCurrency,
      receiveAmount,
      rateApplied,
      feeCharged,
      beneficiaryName,
      beneficiaryDetails,
      userNotes,
    } = body;
    
    // Get existing transaction
    const existingTransaction = await kv.get(`transaction:${id}`);
    if (!existingTransaction) {
      return c.json({ success: false, error: 'Transaction not found' }, 404);
    }
    
    // Validate required fields
    if (
      !type ||
      !sendCurrency ||
      !sendAmount ||
      !receiveCurrency ||
      !receiveAmount ||
      rateApplied === undefined ||
      feeCharged === undefined
    ) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }
    
    // Validate bank transfer specific fields
    if (type === 'BANK_TRANSFER' && !beneficiaryDetails) {
      return c.json({ success: false, error: 'Beneficiary details (IBAN/Card) are required for bank transfers' }, 400);
    }
    
    // Store previous version in edit history
    const editHistory = existingTransaction.editHistory || [];
    editHistory.push({
      editedAt: new Date().toISOString(),
      previousVersion: {
        type: existingTransaction.type,
        sendCurrency: existingTransaction.sendCurrency,
        sendAmount: existingTransaction.sendAmount,
        receiveCurrency: existingTransaction.receiveCurrency,
        receiveAmount: existingTransaction.receiveAmount,
        rateApplied: existingTransaction.rateApplied,
        feeCharged: existingTransaction.feeCharged,
        beneficiaryName: existingTransaction.beneficiaryName,
        beneficiaryDetails: existingTransaction.beneficiaryDetails,
        userNotes: existingTransaction.userNotes,
      },
    });
    
    // Update transaction
    const updatedTransaction = {
      ...existingTransaction,
      type,
      sendCurrency,
      sendAmount: Number(sendAmount),
      receiveCurrency,
      receiveAmount: Number(receiveAmount),
      rateApplied: Number(rateApplied),
      feeCharged: Number(feeCharged),
      beneficiaryName: beneficiaryName || '',
      beneficiaryDetails: beneficiaryDetails || '',
      userNotes: userNotes || '',
      editHistory,
      lastEditedAt: new Date().toISOString(),
      isEdited: true,
    };
    
    await kv.set(`transaction:${id}`, updatedTransaction);
    
    return c.json({ success: true, transaction: updatedTransaction });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ===========================
// DAILY RATES ROUTES
// ===========================

// Get daily rates (current or by date)
app.get('/make-server-a3e538f5/daily-rates', async (c) => {
  try {
    const dateParam = c.req.query('date');
    const date = dateParam || new Date().toISOString().split('T')[0];
    
    const rates = await kv.get(`daily_rates:${date}`);
    
    if (!rates) {
      // Return default structure if no rates set
      return c.json({
        success: true,
        rates: {
          date,
          EUR: 0,
          USD: 0,
          GBP: 0,
          CAD: 0,
        },
      });
    }
    
    return c.json({ success: true, rates });
  } catch (error) {
    console.error('Error fetching daily rates:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Set daily rates
app.post('/make-server-a3e538f5/daily-rates', async (c) => {
  try {
    const body = await c.req.json();
    const { EUR, USD, GBP, CAD, date } = body;
    
    const rateDate = date || new Date().toISOString().split('T')[0];
    
    const rates = {
      date: rateDate,
      EUR: Number(EUR) || 0,
      USD: Number(USD) || 0,
      GBP: Number(GBP) || 0,
      CAD: Number(CAD) || 0,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`daily_rates:${rateDate}`, rates);
    
    return c.json({ success: true, rates });
  } catch (error) {
    console.error('Error setting daily rates:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Health check
app.get('/make-server-a3e538f5/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

Deno.serve(app.fetch);
