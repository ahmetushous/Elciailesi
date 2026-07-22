const SUPABASE_URL = "https://mrwoyxemuzrywubfuywh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yd295eGVtdXpyeXd1YmZ1eXdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NTU1ODIsImV4cCI6MjEwMDEzMTU4Mn0.ljrdAhFZLQP1zwfRRDsw3d5-uswfygt5gcRlVLPkc40";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_EMAIL = "Elcihanedanligi63@gmail.com";
let currentUser = null;
let products = [];
let isSpinning = false;
let startAngle = 0;
let resendTimer = null;
let countdownSeconds = 60;

if ("Notification" in window) {
    Notification.requestPermission();
}

async function sendOtp() {
    const name = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const msg = document.getElementById('message');

    if(!name || !email) {
        alert("Lütfen isim ve e-posta alanlarını doldurun.");
        return;
    }

    msg.innerText = "Kod gönderiliyor, lütfen bekleyin...";

    try {
        const { data, error } = await _supabase.auth.signInWithOtp({ 
            email: email, 
            options: { data: { full_name: name } } 
        });

        if (error) {
            console.error("Supabase Hatası:", error);
            msg.innerText = "Hata: " + error.message;
            alert("Kod Gönderilemedi!\nSebep: " + error.message);
        } else {
            msg.innerText = "E-postanıza gelen doğrulama kodunu girin.";
            document.getElementById('step1').classList.add('hidden');
            document.getElementById('step2').classList.remove('hidden');
            startResendCooldown();
        }
    } catch (err) {
        console.error("Sistem Hatası:", err);
        msg.innerText = "Bir sistem hatası oluştu.";
        alert("Sistem Hatası: " + err.message);
    }
}

async function resendOtp() {
    const email = document.getElementById('email').value.trim();
    const msg = document.getElementById('message');
    msg.innerText = "Yeni kod gönderiliyor...";
    
    try {
        const { error } = await _supabase.auth.signInWithOtp({ email });
        if(error) {
            alert("Yeniden Kod Hatası: " + error.message);
            msg.innerText = "Hata: " + error.message;
        } else {
            msg.innerText = "Yeni kod e-postanıza gönderildi!";
            startResendCooldown();
        }
    } catch (err) {
        alert("Sistem Hatası: " + err.message);
    }
}

function startResendCooldown() {
    const resendBtn = document.getElementById('resendBtn');
    resendBtn.disabled = true;
    countdownSeconds = 60;
    
    if(resendTimer) clearInterval(resendTimer);
    
    resendTimer = setInterval(() => {
        countdownSeconds--;
        if(countdownSeconds <= 0) {
            clearInterval(resendTimer);
            resendBtn.disabled = false;
            resendBtn.innerText = "Tekrar Kod Gönder 📩";
        } else {
            resendBtn.innerText = `Tekrar Kod Gönder (${countdownSeconds}s)`;
        }
    }, 1000);
}

async function verifyOtp() {
    const email = document.getElementById('email').value.trim();
    const token = document.getElementById('otpCode').value.trim();
    const name = document.getElementById('fullName').value.trim();
    const msg = document.getElementById('message');

    if(!token) return alert("Lütfen doğrulama kodunu girin.");

    const { data, error } = await _supabase.auth.verifyOtp({ email, token, type: 'email' });
    if(error) return alert("Hatalı veya süresi dolmuş kod!");

    currentUser = data.user;
    
    await _supabase.from('profiles').upsert({ 
        id: currentUser.id, 
        full_name: name || currentUser.user_metadata.full_name, 
        email: email 
    });

    msg.innerText = "";
    initApp();
}

function toggleMenu() {
    document.getElementById('drawer').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('active');
    if(document.getElementById('drawer').classList.contains('open')) {
        loadSpinLogs();
    }
}

function formatDate(isoString) {
    const d = new Date(isoString);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const DD = String(d.getDate()).padStart(2, '0');
    const MM = String(d.getMonth() + 1).padStart(2, '0');
    const YYYY = d.getFullYear();
    return `${hh}.${mm} ${DD}.${MM}.${YYYY}`;
}

async function loadSpinLogs() {
    const logList = document.getElementById('logList');
    logList.innerHTML = "Yükleniyor...";

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await _supabase
        .from('spin_logs')
        .select('*')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false });

    if(error || !data || data.length === 0) {
        logList.innerHTML = "<p style='color:#aaa; font-size:13px;'>Son 30 güne ait kayıt bulunamadı.</p>";
        return;
    }

    logList.innerHTML = "";
    data.forEach(log => {
        logList.innerHTML += `
            <div class="log-item">
                <strong>${formatDate(log.created_at)}</strong> - ${log.user_name} - <strong>${log.product_name}</strong> kazandı!
            </div>
        `;
    });
}

async function initApp() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('appSection').classList.remove('hidden');
    
    const name = currentUser.user_metadata.full_name || "Kullanıcı";
    document.getElementById('welcomeText').innerText = `Hoş geldin, ${name}!`;

    if(currentUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        document.getElementById('adminPanel').classList.remove('hidden');
    }

    await loadProducts();
    await checkSpinRight();
}

async function loadProducts() {
    const { data, error } = await _supabase.from('products').select('*');
    if (error) {
        console.error("Ürün çekme hatası:", error);
        return;
    }
    products = data ? data.filter(p => p.stock > 0) : [];
    drawWheel();
    renderAdminStockList(data || []);
}

function drawWheel() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 300, 300);

    if(products.length === 0) {
        ctx.fillStyle = "#fff";
        ctx.font = "16px sans-serif";
        ctx.fillText("Stokta Ürün Yok!", 90, 150);
        return;
    }

    const arc = (2 * Math.PI) / products.length;
    const colors = ['#e94560', '#0f3460', '#533483', '#00fff5', '#ffbd59', '#4e9f3d'];

    products.forEach((prod, i) => {
        const angle = startAngle + i * arc;
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.arc(150, 150, 140, angle, angle + arc, false);
        ctx.arc(150, 150, 0, angle + arc, angle, true);
        ctx.fill();

        ctx.save();
        ctx.fillStyle = "#fff";
        ctx.translate(150 + Math.cos(angle + arc / 2) * 90, 150 + Math.sin(angle + arc / 2) * 90);
        ctx.rotate(angle + arc / 2 + Math.PI / 2);
        ctx.font = "bold 13px sans-serif";
        ctx.fillText(prod.name, -ctx.measureText(prod.name).width / 2, 0);
        ctx.restore();
    });
}

async function checkSpinRight() {
    const { data } = await _supabase.from('profiles').select('last_spin_at').eq('id', currentUser.id).single();
    const btn = document.getElementById('spinBtn');
    const timer = document.getElementById('timerText');

    if(data && data.last_spin_at) {
        const lastSpin = new Date(data.last_spin_at).getTime();
        const now = new Date().getTime();
        const diffHours = (now - lastSpin) / (1000 * 60 * 60);

        if(diffHours < 24) {
            btn.disabled = true;
            const remainingMs = (24 * 60 * 60 * 1000) - (now - lastSpin);
            startCountdown(remainingMs);
            return;
        }
    }
    btn.disabled = false;
    timer.innerText = "Çarkı çevirebilirsin!";
}

function startCountdown(ms) {
    const timer = document.getElementById('timerText');
    let interval = setInterval(() => {
        ms -= 1000;
        if(ms <= 0) {
            clearInterval(interval);
            document.getElementById('spinBtn').disabled = false;
            timer.innerText = "Çark hakkın yenilendi!";
            sendPushNotification();
        } else {
            const h = Math.floor(ms / (1000 * 60 * 60));
            const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((ms % (1000 * 60)) / 1000);
            timer.innerText = `Kalan Süre: ${h}s ${m}d ${s}sn`;
        }
    }, 1000);
}

function sendPushNotification() {
    const name = currentUser.user_metadata.full_name || "Kullanıcı";
    if (Notification.permission === "granted") {
        new Notification("Abur Cubur Çarkı 🎡", {
            body: `Hey ${name} çark hakkın yenilendi gel ve ödülünü al.`,
            icon: "https://cdn-icons-png.flaticon.com/512/811/811462.png"
        });
    }
}

async function spinWheel() {
    if(isSpinning || products.length === 0) return;
    isSpinning = true;

    const spinAngle = Math.floor(Math.random() * 360) + 1440;
    const duration = 4000;
    const start = performance.now();

    function animate(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        startAngle = (easeOut * spinAngle * Math.PI / 180);
        drawWheel();

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            isSpinning = false;
            handleWin();
        }
    }
    requestAnimationFrame(animate);
}

async function handleWin() {
    const degrees = (startAngle * 180 / Math.PI) % 360;
    const index = Math.floor((360 - degrees) / (360 / products.length)) % products.length;
    const wonProduct = products[index];
    const userName = currentUser.user_metadata.full_name || "Kullanıcı";

    alert(`TEBRİKLER! 🎉 Kazandığın Ödül: ${wonProduct.name}`);

    // Stok düşürme işlemi ve hata yakalama
    const newStock = Math.max(0, wonProduct.stock - 1);
    const { error: updateError } = await _supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', wonProduct.id);

    if (updateError) {
        console.error("Stok düşürme hatası:", updateError);
        alert("Stok güncellenirken hata oluştu: " + updateError.message);
    }

    // Son çevirme zamanını kaydet
    await _supabase
        .from('profiles')
        .update({ last_spin_at: new Date().toISOString() })
        .eq('id', currentUser.id);

    // Geçmiş loguna ekle
    await _supabase
        .from('spin_logs')
        .insert([{ user_name: userName, product_name: wonProduct.name }]);

    await loadProducts();
    await checkSpinRight();
}

async function addProduct() {
    const name = document.getElementById('prodName').value.trim();
    const stock = parseInt(document.getElementById('prodStock').value);

    if(!name || isNaN(stock) || stock <= 0) {
        return alert("Lütfen geçerli bir ürün adı ve 0'dan büyük bir stok adedi girin.");
    }

    const { error } = await _supabase.from('products').insert([{ name: name, stock: stock }]);
    
    if (error) {
        alert("Ekleme hatası oluştu: " + error.message);
        console.error(error);
        return;
    }

    document.getElementById('prodName').value = "";
    document.getElementById('prodStock').value = "";
    alert(`"${name}" (${stock} adet) başarıyla eklendi!`);

    await loadProducts();
}

function renderAdminStockList(data) {
    const list = document.getElementById('stockList');
    list.innerHTML = "";
    data.forEach(item => {
        const itemName = item.name || "İsimsiz Ürün";
        list.innerHTML += `
            <div class="stock-item">
                <span><strong>${itemName}</strong> (${item.stock} Adet)</span>
                <button onclick="deleteProduct('${item.id}')" style="background:red; color:#fff; border:none; padding:2px 8px; border-radius:4px; cursor:pointer;">Sil</button>
            </div>
        `;
    });
}

async function deleteProduct(id) {
    await _supabase.from('products').delete().eq('id', id);
    await loadProducts();
}
