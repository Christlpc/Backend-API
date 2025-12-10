async function run() {
    try {
        const phone = `+24206${Math.floor(Math.random() * 10000000)}`;
        const password = 'password123';

        // Register
        await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone,
                password,
                firstName: 'Test',
                lastName: 'User'
            })
        });

        // Login
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone,
                password
            })
        });

        if (!loginRes.ok) {
            throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
        }

        const loginData = await loginRes.json();
        const token = loginData.token;

        // Now try to create an address with invalid latitude
        const res = await fetch('http://localhost:3000/api/addresses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                label: "Test Address",
                addressText: "Rue Test",
                latitude: "invalid_float", // This should cause the error
                longitude: "15.283",
                landmark: "Test Landmark"
            })
        });

        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Body:', text);

    } catch (error) {
        console.error('Error:', error);
    }
}

run();
