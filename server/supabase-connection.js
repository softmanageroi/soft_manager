
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
    console.error('Missing Supabase environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
    }
});

async function testConnection() {
    try {
        const { data, error } = await supabase
            .from('inventory_items')
            .select('id')
            .limit(1);

        if (error) {
            console.error('Supabase test failed:', error.message);
            process.exitCode = 1;
            return;
        }

        console.log('✅ Supabase connection successful!');
        console.log('✅ Inventory table accessible.');
        console.log('Rows returned:', data.length);

    } catch (error) {
        console.error('Connection error:', error.message);
        process.exitCode = 1;
    }
}

testConnection();

