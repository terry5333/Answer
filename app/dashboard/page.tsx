{/* 頂部導覽列 */}
<div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-[3rem] p-6 px-10 flex justify-between items-center shadow-lg">
  <h1 className="text-2xl font-bold text-gray-800 tracking-tight">📖 學生解答大廳</h1>
  
  <div className="flex items-center gap-4 md:gap-6">
    {/* 🚀 新增：Google 頭像與身分標籤結合 */}
    <div className="flex items-center gap-3 bg-white/60 px-2 py-1.5 pr-5 rounded-full border border-indigo-100 shadow-sm">
      <img 
        src={auth.currentUser?.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=Student"} 
        alt="Avatar" 
        className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
        referrerPolicy="no-referrer"
      />
      <div className="text-indigo-700 font-bold text-sm md:text-base">
        {userData?.seat_number} 號 - {userData?.name}
      </div>
    </div>
    
    <button onClick={handleLogout} className="bg-red-400 hover:bg-red-500 text-white px-5 py-2.5 rounded-[2rem] font-bold shadow-md transition-all active:scale-95">
      登出
    </button>
  </div>
</div>
