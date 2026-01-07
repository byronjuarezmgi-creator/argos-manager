import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, onSnapshot, 
  addDoc, updateDoc, deleteDoc, getDocs, query, where 
} from 'firebase/firestore'; 
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Plus, MessageSquare, Trash2, Layout, 
  User, X, Send, Database, AlertCircle, Settings, 
  Lock, Unlock, Clock, Briefcase, Users, LogIn, LogOut,
  Edit2, Eye, EyeOff, Shield, UserPlus
} from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyC5p3Hs08DRmoZ-TORtAOdyO7NYoU5PsDY",
  authDomain: "argos-solution.firebaseapp.com",
  projectId: "argos-solution",
  storageBucket: "argos-solution.firebasestorage.app",
  messagingSenderId: "247770655042",
  appId: "1:247770655042:web:def64655d90e5c12e1c0db",
  measurementId: "G-T2MBMQ769S"
};

// --- VALIDACIÓN ---
const isConfigured = firebaseConfig.apiKey !== "TU_API_KEY_AQUI";

let app, auth, db;
if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Error inicializando Firebase:", e);
  }
}

const appId = 'argos-production-v1'; 

// --- UTILIDADES ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const COLORS = {
  status: {
    done: 'bg-green-400 text-white',
    working: 'bg-orange-400 text-white',
    stuck: 'bg-red-400 text-white',
    default: 'bg-gray-300 text-gray-700'
  },
  crm: {
    new: 'bg-blue-400 text-white',
    contacted: 'bg-yellow-400 text-white',
    won: 'bg-green-500 text-white',
    lost: 'bg-gray-400 text-white'
  }
};

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  if (!isConfigured) return <ConfigInstructions />;

  const [firebaseUser, setFirebaseUser] = useState(null);
  
  // ESTADO DE LA APP
  const [currentUser, setCurrentUser] = useState(null); // { name, role, id }
  const [view, setView] = useState('login'); // 'login', 'app'
  
  // DATOS
  const [boards, setBoards] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [activeSection, setActiveSection] = useState('projects'); // 'projects', 'crm', 'users'

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCommentRow, setActiveCommentRow] = useState(null);

  // --- INICIALIZACIÓN ---
  useEffect(() => {
    if (!auth) return;
    signInAnonymously(auth).catch(err => console.error(err));
    const unsubscribe = onAuthStateChanged(auth, u => setFirebaseUser(u));
    return () => unsubscribe();
  }, []);

  // --- CARGA DE DATOS ---
  useEffect(() => {
    if (!firebaseUser || !db) return;

    // 1. Cargar Tableros
    const qBoards = collection(db, 'argos_data', appId, 'boards');
    const unsubBoards = onSnapshot(qBoards, (snapshot) => {
      const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      loaded.sort((a, b) => a.createdAt - b.createdAt);
      setBoards(loaded);
      setLoading(false);
    }, (err) => setError(err.message));

    // 2. Cargar Usuarios (Para el Admin y Login)
    const qUsers = collection(db, 'argos_data', appId, 'users');
    const unsubUsers = onSnapshot(qUsers, async (snapshot) => {
      let loadedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // SI NO HAY USUARIOS, CREAR LOS POR DEFECTO CON LOS NOMBRES NUEVOS
      if (loadedUsers.length === 0) {
        await createDefaultUsers();
      } else {
        setUsersList(loadedUsers);
      }
    });

    return () => { unsubBoards(); unsubUsers(); };
  }, [firebaseUser]);

  const createDefaultUsers = async () => {
    const adminUser = { name: "bjuarez", password: "argos2024", role: "admin", createdAt: Date.now() };
    const viewUser = { name: "jsamayoa", password: "Argos2026*", role: "viewer", createdAt: Date.now() };
    await addDoc(collection(db, 'argos_data', appId, 'users'), adminUser);
    await addDoc(collection(db, 'argos_data', appId, 'users'), viewUser);
  };

  // --- LOGIN ---
  const handleLogin = (username, password) => {
    const foundUser = usersList.find(u => u.name.toLowerCase() === username.toLowerCase() && u.password === password);
    
    if (foundUser) {
      setCurrentUser(foundUser);
      setView('app');
      // Seleccionar primer tablero por defecto
      if (boards.length > 0) {
         const first = boards.find(b => b.type !== 'crm') || boards[0];
         if(first) setActiveBoardId(first.id);
      }
    } else {
      alert("⛔ Credenciales incorrectas");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('login');
    setActiveSection('projects');
  };

  // --- GESTIÓN DE USUARIOS (ADMIN) ---
  const createUser = async () => {
    const name = prompt("Nombre de usuario (Login):");
    if (!name) return;
    const password = prompt("Contraseña:");
    if (!password) return;
    const role = confirm("¿Es Administrador? (Aceptar = Sí, Cancelar = Solo Lectura)") ? 'admin' : 'viewer';

    await addDoc(collection(db, 'argos_data', appId, 'users'), {
      name, password, role, createdAt: Date.now()
    });
  };

  const deleteUser = async (userId) => {
    if (!confirm("¿Borrar usuario?")) return;
    await deleteDoc(doc(db, 'argos_data', appId, 'users', userId));
  };

  // --- GESTIÓN DE TABLEROS ---
  const createNewBoard = async (type = 'project') => {
    const defaultTitle = type === 'crm' ? "Nuevo Listado de Clientes" : "Nuevo Proyecto";
    const title = prompt(`Nombre:`, defaultTitle);
    if (!title) return;

    let columns = [];
    if (type === 'crm') {
      columns = [
        { id: 'col_client', title: 'Cliente / Empresa', type: 'text', width: 'w-1/3' },
        { id: 'col_status', title: 'Estatus', type: 'crm_status', width: 'w-32' },
        { id: 'col_contact', title: 'Contacto', type: 'text', width: 'w-40' },
        { id: 'col_phone', title: 'Teléfono', type: 'text', width: 'w-32' },
        { id: 'col_next', title: 'Siguiente Paso', type: 'text', width: 'w-40' },
      ];
    } else {
      columns = [
        { id: 'col_item', title: 'Tarea', type: 'text', width: 'w-1/3' },
        { id: 'col_status', title: 'Estado', type: 'status', width: 'w-32' },
        { id: 'col_start', title: 'Inicio', type: 'date', width: 'w-32' },
        { id: 'col_end', title: 'Fin', type: 'date', width: 'w-32' },
        { id: 'col_duration', title: 'Días', type: 'duration', width: 'w-24' },
        { id: 'col_resp', title: 'Responsable', type: 'text', width: 'w-40' },
      ];
    }

    const newBoard = { title, type, createdAt: Date.now(), columns, rows: [] };
    try {
      const ref = await addDoc(collection(db, 'argos_data', appId, 'boards'), newBoard);
      setActiveBoardId(ref.id);
      setActiveSection(type === 'crm' ? 'crm' : 'projects');
    } catch (e) { alert(e.message); }
  };

  const deleteBoard = async (boardId) => {
    if(!confirm("¿Borrar tabla completa?")) return;
    await deleteDoc(doc(db, 'argos_data', appId, 'boards', boardId));
    if (activeBoardId === boardId) setActiveBoardId(null);
  };

  // --- GESTIÓN DE COLUMNAS (NUEVO) ---
  const updateBoard = async (boardId, data) => {
    await updateDoc(doc(db, 'argos_data', appId, 'boards', boardId), data);
  };

  const renameColumn = async (board, colId) => {
    const col = board.columns.find(c => c.id === colId);
    const newTitle = prompt("Nuevo nombre para la columna:", col.title);
    if (!newTitle) return;
    
    const newColumns = board.columns.map(c => c.id === colId ? { ...c, title: newTitle } : c);
    await updateBoard(board.id, { columns: newColumns });
  };

  const addColumn = async (board) => {
    const title = prompt("Nombre de la nueva columna:");
    if (!title) return;
    
    // Tipo simple por defecto, podría expandirse a un selector
    const newCol = { id: generateId(), title, type: 'text', width: 'w-40' };
    await updateBoard(board.id, { columns: [...board.columns, newCol] });
  };

  const deleteColumn = async (board, colId) => {
    if(!confirm("¿Borrar columna? Los datos se perderán.")) return;
    const newColumns = board.columns.filter(c => c.id !== colId);
    await updateBoard(board.id, { columns: newColumns });
  };

  // --- GESTIÓN DE FILAS ---
  const addRow = async (board) => {
    const newRow = { id: generateId(), values: {}, comments: [] };
    await updateBoard(board.id, { rows: [...board.rows, newRow] });
  };

  const deleteRow = async (board, rowId) => {
    if (!confirm("¿Borrar fila?")) return;
    await updateBoard(board.id, { rows: board.rows.filter(r => r.id !== rowId) });
  };

  const updateCell = async (board, rowId, colId, val) => {
    const newRows = board.rows.map(r => r.id === rowId ? { ...r, values: { ...r.values, [colId]: val } } : r);
    await updateBoard(board.id, { rows: newRows });
  };

  const addComment = async (board, rowId, text) => {
    const newRows = board.rows.map(r => {
      if (r.id === rowId) {
        return { 
          ...r, 
          comments: [...(r.comments || []), { id: generateId(), text, author: currentUser.name, timestamp: Date.now() }] 
        };
      }
      return r;
    });
    await updateBoard(board.id, { rows: newRows });
  };


  // --- RENDERIZADO ---
  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white animate-pulse">Cargando Argos...</div>;
  if (view === 'login') return <LoginScreen onLogin={handleLogin} users={usersList} />;

  // Filtrados
  const projectBoards = boards.filter(b => b.type !== 'crm');
  const crmBoards = boards.filter(b => b.type === 'crm');
  const activeBoard = boards.find(b => b.id === activeBoardId);
  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="flex h-screen bg-white font-sans text-sm text-gray-800">
      
      {/* SIDEBAR */}
      <div className="w-64 bg-slate-900 text-white flex flex-col border-r border-slate-700">
        <div className="p-5 border-b border-slate-700 bg-slate-800">
          <h1 className="font-bold text-xl flex items-center gap-2 text-blue-400">
            <Database /> ARGOS
          </h1>
          <p className="text-xs text-slate-400 mt-1">Video Telemática & CRM</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          
          {/* PROYECTOS */}
          <div>
            <div className={`flex items-center gap-2 px-2 py-1 text-xs font-bold uppercase cursor-pointer ${activeSection === 'projects' ? 'text-blue-400' : 'text-slate-500'}`} onClick={() => setActiveSection('projects')}>
              <Briefcase size={14} /> PROYECTOS
            </div>
            {activeSection === 'projects' && (
              <div className="mt-2 space-y-1 pl-2">
                {projectBoards.map(b => (
                  <SidebarItem key={b.id} title={b.title} active={activeBoardId === b.id} onClick={() => setActiveBoardId(b.id)} isAdmin={isAdmin} onDelete={() => deleteBoard(b.id)} icon={<Layout size={14}/>} />
                ))}
                {isAdmin && <AddButton onClick={() => createNewBoard('project')} label="Proyecto" />}
              </div>
            )}
          </div>

          {/* CRM */}
          <div>
            <div className={`flex items-center gap-2 px-2 py-1 text-xs font-bold uppercase cursor-pointer ${activeSection === 'crm' ? 'text-green-400' : 'text-slate-500'}`} onClick={() => setActiveSection('crm')}>
              <Users size={14} /> CLIENTES (CRM)
            </div>
            {activeSection === 'crm' && (
              <div className="mt-2 space-y-1 pl-2">
                {crmBoards.map(b => (
                  <SidebarItem key={b.id} title={b.title} active={activeBoardId === b.id} onClick={() => setActiveBoardId(b.id)} isAdmin={isAdmin} onDelete={() => deleteBoard(b.id)} icon={<User size={14}/>} />
                ))}
                {isAdmin && <AddButton onClick={() => createNewBoard('crm')} label="Listado CRM" />}
              </div>
            )}
          </div>

          {/* USUARIOS (SOLO ADMIN) */}
          {isAdmin && (
            <div>
              <div className={`flex items-center gap-2 px-2 py-1 text-xs font-bold uppercase cursor-pointer ${activeSection === 'users' ? 'text-purple-400' : 'text-slate-500'}`} onClick={() => { setActiveSection('users'); setActiveBoardId(null); }}>
                <Shield size={14} /> USUARIOS
              </div>
            </div>
          )}

        </div>

        <div className="p-4 bg-slate-950 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold">
              {currentUser.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="font-bold truncate">{currentUser.name}</p>
              <p className="text-xs text-slate-400 capitalize">{currentUser.role === 'admin' ? 'Administrador' : 'Solo Lectura'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2 rounded text-xs bg-slate-800 hover:bg-slate-700 transition-colors">
            <LogOut size={12} /> Cerrar Sesión
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
        
        {/* VISTA DE USUARIOS */}
        {activeSection === 'users' && isAdmin ? (
           <UsersManager users={usersList} onCreate={createUser} onDelete={deleteUser} />
        ) : activeBoard ? (
          // VISTA DE TABLERO
          <>
            <div className="bg-white border-b px-6 py-4 shadow-sm flex items-center justify-between">
              <div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${activeBoard.type === 'crm' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {activeBoard.type === 'crm' ? 'CRM' : 'Proyecto'}
                </span>
                <h2 className="text-2xl font-bold text-slate-800 mt-1">{activeBoard.title}</h2>
              </div>
              {isAdmin && (
                 <button onClick={() => addColumn(activeBoard)} className="flex items-center gap-2 text-xs bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded text-slate-600">
                    <Plus size={14}/> Nueva Columna
                 </button>
              )}
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="bg-white rounded-lg shadow border border-gray-200 min-w-max pb-20">
                {/* HEADERS */}
                <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                  <div className="w-10 border-r border-gray-100"></div>
                  {activeBoard.columns.map(col => (
                    <div key={col.id} className={`${col.width || 'w-40'} p-3 border-r border-gray-100 flex items-center justify-between group`}>
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{col.title}</span>
                      {isAdmin && (
                        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                          <button onClick={() => renameColumn(activeBoard, col.id)} className="p-1 hover:bg-blue-100 rounded text-blue-500"><Edit2 size={12}/></button>
                          <button onClick={() => deleteColumn(activeBoard, col.id)} className="p-1 hover:bg-red-100 rounded text-red-500"><X size={12}/></button>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="w-20 p-3 text-xs font-bold text-gray-500 text-center uppercase border-r border-gray-100">Chat</div>
                  {isAdmin && <div className="w-10"></div>}
                </div>

                {/* ROWS */}
                {activeBoard.rows.map(row => (
                  <div key={row.id} className="flex border-b border-gray-100 hover:bg-slate-50 bg-white">
                    <div className="w-10 border-r border-gray-100 p-3 flex items-center justify-center bg-gray-50">
                       <div className={`w-1.5 h-4 rounded-full ${activeBoard.type === 'crm' ? 'bg-green-400' : 'bg-blue-400'}`}></div>
                    </div>
                    {activeBoard.columns.map(col => (
                      <div key={col.id} className={`${col.width || 'w-40'} border-r border-gray-100 flex-shrink-0`}>
                        <Cell 
                          type={col.type} 
                          value={row.values[col.id]} 
                          rowValues={row.values}
                          isAdmin={isAdmin}
                          onChange={(val) => updateCell(activeBoard, row.id, col.id, val)} 
                        />
                      </div>
                    ))}
                    <div className="w-20 border-r border-gray-100 flex items-center justify-center">
                       <button onClick={() => setActiveCommentRow({ row, board: activeBoard })} className={`p-2 rounded-full hover:bg-gray-100 ${row.comments?.length ? 'text-blue-500' : 'text-gray-300'}`}>
                         <MessageSquare size={16} />
                       </button>
                    </div>
                    {isAdmin && (
                      <div className="w-10 flex items-center justify-center">
                        <button onClick={() => deleteRow(activeBoard, row.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14}/></button>
                      </div>
                    )}
                  </div>
                ))}
                
                {isAdmin && (
                  <div className="flex border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => addRow(activeBoard)}>
                    <div className={`w-10 border-r border-gray-100 ${activeBoard.type === 'crm' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                    <div className="flex-1 p-2 pl-4 text-gray-500 flex items-center gap-2 text-sm">
                      <Plus size={16} /> <span>Agregar Fila</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <EmptyState />
        )}
      </div>

      {activeCommentRow && (
        <CommentDrawer 
          row={activeCommentRow.row} 
          onClose={() => setActiveCommentRow(null)} 
          onSend={(txt) => addComment(activeCommentRow.board, activeCommentRow.row.id, txt)} 
        />
      )}
    </div>
  );
}

// --- PANTALLA DE LOGIN ---
function LoginScreen({ onLogin, users }) {
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");

  return (
    <div className="h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-blue-600 p-8 text-center flex flex-col items-center">
          
          <img 
            src="/logo-argos.png" 
            alt="Logo Corporativo" 
            className="h-24 mb-4 object-contain"
            onError={(e) => {
              e.target.onerror = null; 
              e.target.style.display = 'none'; 
            }}
          />
          
          <h1 className="text-3xl font-bold text-white tracking-tight">ARGOS</h1>
          <p className="text-blue-100 mt-1">Plataforma de Gestión Inteligente</p>
        </div>
        <div className="p-8">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Usuario</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                placeholder="Ingresa tu usuario"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Contraseña</label>
              <input 
                type="password" 
                value={pass}
                onChange={e => setPass(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                placeholder="••••••••"
              />
            </div>
            <button 
              onClick={() => onLogin(name, pass)}
              className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 transition-transform active:scale-95"
            >
              ACCEDER
            </button>
          </div>
          <div className="mt-6 text-center text-xs text-gray-400">
            <p>Acceso restringido a personal autorizado.</p>
            <p className="mt-2">ARGOS SOLUTION © 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- GESTOR DE USUARIOS ---
function UsersManager({ users, onCreate, onDelete }) {
  return (
    <div className="p-8 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Shield /> Gestión de Usuarios</h2>
          <p className="text-gray-500">Administra quién tiene acceso a la plataforma.</p>
        </div>
        <button onClick={onCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-blue-200 transition-all">
          <UserPlus size={18} /> Crear Usuario
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(u => (
          <div key={u.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col relative group hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${u.role === 'admin' ? 'bg-purple-500' : 'bg-blue-400'}`}>
                {u.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-gray-800">{u.name}</h3>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {u.role === 'admin' ? 'Administrador' : 'Solo Lectura'}
                </span>
              </div>
            </div>
            <div className="mt-auto pt-3 border-t border-gray-50 flex justify-between items-center text-xs text-gray-400">
               <span>Clave: {u.password.substring(0,2)}•••</span>
               {u.role !== 'admin' || users.filter(x => x.role === 'admin').length > 1 ? (
                 <button onClick={() => onDelete(u.id)} className="text-red-400 hover:text-red-600 flex items-center gap-1">
                   <Trash2 size={12} /> Eliminar
                 </button>
               ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- COMPONENTES UI AUXILIARES ---
function SidebarItem({ title, active, onClick, isAdmin, onDelete, icon }) {
  return (
    <div 
      onClick={onClick}
      className={`group flex items-center justify-between px-3 py-2 rounded cursor-pointer transition-colors ${active ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
    >
      <div className="flex items-center gap-2 truncate">
        {icon} <span className="truncate">{title}</span>
      </div>
      {isAdmin && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="opacity-0 group-hover:opacity-100 hover:text-red-300 transition-opacity">
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

function AddButton({ onClick, label }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 w-full rounded mt-1 transition-colors border border-dashed border-slate-700 text-xs">
      <Plus size={12} /> {label}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
      <Layout size={48} className="mb-4 text-gray-300" />
      <p className="text-lg font-medium text-gray-500">Selecciona un elemento del menú</p>
    </div>
  );
}

function Cell({ type, value, rowValues, onChange, isAdmin }) {
  if (type === 'duration') {
    const start = rowValues?.['col_start'];
    const end = rowValues?.['col_end'];
    let display = "-", bgClass = "bg-gray-50 text-gray-400";

    if (start && end) {
      const diff = Math.ceil((new Date(end) - new Date(start)) / (86400000));
      if (diff < 0) { display = "Err"; bgClass = "bg-red-100 text-red-600"; }
      else { display = `${diff}d`; bgClass = "bg-blue-100 text-blue-700"; }
    }
    return <div className="h-full p-2 flex items-center justify-center"><div className={`px-2 py-1 rounded text-xs ${bgClass} font-bold`}>{display}</div></div>;
  }

  if (['status', 'crm_status'].includes(type)) {
    const isCrm = type === 'crm_status';
    const opts = isCrm ? 
      [{v:'new',l:'Prospecto',c:COLORS.crm.new}, {v:'contacted',l:'Contactado',c:COLORS.crm.contacted}, {v:'won',l:'Cerrado',c:COLORS.crm.won}, {v:'lost',l:'Perdido',c:COLORS.crm.lost}] :
      [{v:'done',l:'Listo',c:COLORS.status.done}, {v:'working',l:'En Proceso',c:COLORS.status.working}, {v:'stuck',l:'Detenido',c:COLORS.status.stuck}];
    
    const curr = opts.find(o => o.v === value) || {l:'-',c:COLORS.status.default};

    if (!isAdmin) return <div className={`m-1 h-8 flex items-center justify-center rounded text-xs font-bold ${curr.c}`}>{curr.l}</div>;
    return (
      <div className="p-1 h-full">
        <select value={value||''} onChange={e=>onChange(e.target.value)} className={`w-full h-8 rounded text-center text-xs font-bold cursor-pointer ${curr.c}`}>
          <option value="">-</option>
          {opts.map(o => <option key={o.v} value={o.v} className="bg-white text-black">{o.l}</option>)}
        </select>
      </div>
    );
  }

  if (type === 'date') return <div className="h-full p-1">{isAdmin ? <input type="date" value={value||''} onChange={e=>onChange(e.target.value)} className="w-full h-full text-center text-xs bg-transparent"/> : <div className="h-full flex items-center justify-center text-xs">{value||'-'}</div>}</div>;

  return isAdmin ? 
    <input type="text" value={value||''} onChange={e=>onChange(e.target.value)} className="w-full h-full px-3 text-sm bg-transparent outline-none focus:bg-blue-50" /> : 
    <div className="w-full h-full px-3 flex items-center text-sm truncate" title={value}>{value}</div>;
}

function CommentDrawer({ row, onClose, onSend }) {
  const [txt, setTxt] = useState("");
  const endRef = useRef(null);
  useEffect(() => endRef.current?.scrollIntoView({behavior:"smooth"}), [row.comments]);
  
  return (
    <div className="w-80 border-l border-gray-200 bg-white flex flex-col shadow-xl z-30">
      <div className="p-4 border-b flex justify-between bg-gray-50"><h3 className="font-bold">Bitácora</h3><button onClick={onClose}><X size={18}/></button></div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {row.comments?.map(c => (
          <div key={c.id} className="bg-slate-50 p-3 rounded text-sm border border-slate-100">
            <div className="flex justify-between mb-1"><span className="font-bold text-xs text-blue-600">{c.author}</span><span className="text-[10px] text-gray-400">{new Date(c.timestamp).toLocaleString()}</span></div>
            {c.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={e => { e.preventDefault(); if(txt.trim()){onSend(txt); setTxt("")} }} className="p-3 border-t bg-gray-50 flex gap-2">
        <input value={txt} onChange={e=>setTxt(e.target.value)} className="flex-1 border p-2 rounded text-sm" placeholder="Comentar..." />
        <button type="submit" className="bg-blue-600 text-white p-2 rounded"><Send size={16}/></button>
      </form>
    </div>
  );
}

function ConfigInstructions() { return <div className="h-screen flex items-center justify-center bg-slate-900 text-white">Configura tus claves de Firebase en el código.</div>; }