/* ===== Pro Navbar (glass + subtle gradient) ===== */
:root{
  --nav-h: 64px;
  --radius-xl: 14px;
  --radius-2xl: 20px;
  --bg-panel: rgba(20, 24, 28, 0.55);
  --bg-elev: rgba(22, 27, 34, 0.7);
  --border: rgba(255,255,255,0.08);
  --text: #e9eef5;
  --muted: #9aa7b3;
  --brand: #4f8cff; /* accent you can tweak */
  --brand-2: #7b5cff;
  --shadow: 0 10px 30px rgba(0,0,0,0.25);
}

* { box-sizing: border-box; }

.pro-nav.navbar{
  position: sticky;
  top: 0;
  z-index: 50;
  height: var(--nav-h);
  display: grid;
  grid-template-columns: 1fr minmax(280px, 520px) 1fr;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background:
    linear-gradient(90deg, rgba(79,140,255,0.08), rgba(123,92,255,0.08)) ,
    var(--bg-panel);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(12px) saturate(140%);
  -webkit-backdrop-filter: blur(12px) saturate(140%);
  box-shadow: var(--shadow);
  color: var(--text);
}

.pro-nav .navbar-left,
.pro-nav .navbar-right{
  display:flex; align-items:center; gap:12px;
}

.pro-nav .navbar-center{
  display:flex; justify-content:center; align-items:center;
}

.pro-nav .brand{
  display:flex; align-items:center; gap:10px; text-decoration:none;
}
.pro-nav .navbar-logo{
  height: 36px; width: auto; border-radius: 8px;
  background: rgba(255,255,255,0.04);
  padding: 3px;
  border: 1px solid var(--border);
}
.pro-nav .brand-text{
  font-weight: 700; letter-spacing: .2px; color: var(--text);
}

/* nav links */
.pro-nav .nav-link{
  color: var(--muted);
  text-decoration: none;
  padding: 8px 12px;
  border-radius: var(--radius-xl);
  border: 1px solid transparent;
  transition: all .2s ease;
}
.pro-nav .nav-link:hover{
  color: var(--text);
  border-color: var(--border);
  background: rgba(255,255,255,0.04);
}
.pro-nav .nav-link.active{
  color: var(--text);
  background: linear-gradient(135deg, rgba(79,140,255,0.18), rgba(123,92,255,0.18));
  border-color: rgba(255,255,255,0.14);
}

/* ===== Search ===== */
.pro-nav .search-wrap{
  position: relative; width: 100%;
}
.pro-nav .search-field{
  display:flex; align-items:center; gap:8px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-2xl);
  padding: 8px 10px;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02);
}
.pro-nav .search-input{
  flex:1; border:0; outline:0; background: transparent;
  color: var(--text);
  font-size: 14.5px;
}
.pro-nav .search-input::placeholder{
  color: #8895a3;
}
.pro-nav .icon-btn{
  display:grid; place-items:center;
  width: 34px; height: 34px;
  border-radius: 10px;
  background: transparent;
  color: var(--muted);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all .15s ease;
}
.pro-nav .icon-btn:hover{
  color: var(--text);
  border-color: var(--border);
  background: rgba(255,255,255,0.04);
}
.pro-nav .clear-btn{
  width: 28px; height: 28px; border-radius: 8px;
}

/* suggestions dropdown */
.pro-nav .suggestions{
  position: absolute;
  top: calc(100% + 8px);
  left: 0; right: 0;
  max-height: 340px;
  overflow-y: auto;
  padding: 6px;
  margin: 0;
  list-style: none;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
  animation: fadeSlide .12s ease;
}
@keyframes fadeSlide{
  from{ opacity: 0; transform: translateY(-4px); }
  to{ opacity: 1; transform: translateY(0); }
}
.pro-nav .suggestion{
  padding: 10px 12px;
  border-radius: 12px;
  color: var(--muted);
  cursor: pointer;
  display: flex; align-items: center;
}
.pro-nav .suggestion:hover,
.pro-nav .suggestion.active{
  color: var(--text);
  background: linear-gradient(135deg, rgba(79,140,255,0.12), rgba(123,92,255,0.12));
}
.pro-nav .suggestion-text{
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* ===== Logout button ===== */
.pro-nav .logout-btn.pro{
  margin-left: auto;
  padding: 10px 14px;
  font-weight: 600;
  border-radius: var(--radius-xl);
  border: 1px solid rgba(255,255,255,0.16);
  color: var(--text);
  background:
    linear-gradient(135deg, rgba(123,92,255,0.18), rgba(79,140,255,0.18));
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition: all .2s ease;
}
.pro-nav .logout-btn.pro:hover{
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(0,0,0,0.25);
  border-color: rgba(255,255,255,0.24);
}

/* ===== Responsive ===== */
@media (max-width: 860px){
  .pro-nav.navbar{ grid-template-columns: 1fr 1.2fr auto; gap:8px; }
  .pro-nav .brand-text{ display:none; }
}
@media (max-width: 640px){
  .pro-nav.navbar{ grid-template-columns: 1fr; height: auto; row-gap: 10px; }
  .pro-nav .navbar-left{ order:1; justify-content: space-between; }
  .pro-nav .navbar-center{ order:3; }
  .pro-nav .navbar-right{ order:2; justify-content:flex-end; }
}
