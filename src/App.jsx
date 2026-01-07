import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, onSnapshot, 
  addDoc, updateDoc, deleteDoc 
} from 'firebase/firestore'; 
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Plus, MessageSquare, Trash2, Layout, 
  User, X, Send, Database, AlertCircle, Settings, Lock, Unlock, Clock, Briefcase, Users
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

// --- VALIDACIÓN DE CONFIGURACIÓN ---
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

// Un ID fijo para que todos vean lo mismo en tu empresa
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
  if (!isConfigured) {
    return <ConfigInstructions />;
  }

  const [user, setUser] = useState(null);
  const [boards, setBoards] = useState([]);
  const [activeBoardId, setActiveBoardId] = useState(null);
  
  // false = Cliente, true = Admin
  const [isAdmin, setIsAdmin] = useState(false); 
  
  // Estado para saber qué sección vemos: 'projects' o 'crm'
  const [activeSection, setActiveSection] = useState('projects'); 

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCommentRow, setActiveCommentRow] = useState(null);

  // --- AUTENTICACIÓN ---
  useEffect(() => {
    if (!auth) return;
    
    signInAnonymously(auth).catch((err) => {
      console.error("Error Auth:", err);
      if (err.code === 'auth/api-key-not-valid') {
        setError("La API Key ingresada no es válida. Verifica que la copiaste correctamente de Firebase.");
      } else {
        setError(err.message);
      }
    });
    
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // --- CARGA DE DATOS ---
  useEffect(() => {
    if (!user || !db) return;

    const q = collection(db, 'argos_data', appId, 'boards');
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedBoards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      loadedBoards.sort((a, b) => a.createdAt - b.createdAt);
      setBoards(loadedBoards);
      
      // Si no hay tablero activo, seleccionar el primero disponible de la sección actual
      if (!activeBoardId && loadedBoards.length > 0) {
        // Intentar buscar uno del tipo actual, si no el primero que haya
        const firstRelevant = loadedBoards.find(b => 
          activeSection === 'crm' ? b.type === 'crm' : b.type !== 'crm'
        );
        if (firstRelevant) setActiveBoardId(firstRelevant.id);
      }
      
      setLoading(false);
    }, (err) => {
      console.error("Error cargando tableros:", err);
      setError("Error de conexión: " + err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // --- SEGURIDAD ---
  const handleRoleSwitch = () => {
    if (isAdmin) {
      setIsAdmin(false);
    } else {
      const password = prompt("🔐 Ingrese la contraseña de Administrador:");
      if (password === "argos2024") { 
        setIsAdmin(true);
      } else {
        if (password !== null) alert("⛔ Contraseña incorrecta");
      }
    }
  };

  // --- GESTIÓN DE TABLEROS ---
  const createNewBoard = async (type = 'project') => {
    const defaultTitle = type === 'crm' ? "Nuevo Listado de Clientes" : "Nuevo Proyecto";
    const title = prompt(`Nombre para ${type === 'crm' ? 'la lista de clientes' : 'el proyecto'}:`, defaultTitle);
    if (!title || !user) return;

    let columns = [];

    if (type === 'crm') {
      // Columnas específicas para CRM
      columns = [
        { id: 'col_client', title: 'Cliente / Empresa', type: 'text', width: 'w-1/3' },
        { id: 'col_status', title: 'Estatus Venta', type: 'crm_status', width: 'w-32' },
        { id: 'col_contact', title: 'Contacto Principal', type: 'text', width: 'w-40' },
        { id: 'col_phone', title: 'Teléfono', type: 'text', width: 'w-32' },
        { id: 'col_last_contact', title: 'Último Contacto', type: 'date', width: 'w-32' },
        { id: 'col_next', title: 'Siguiente Paso', type: 'text', width: 'w-40' },
      ];
    } else {
      // Columnas para Proyectos (Lógica anterior)
      columns = [
        { id: 'col_item', title: 'Tarea / Elemento', type: 'text', width: 'w-1/3' },
        { id: 'col_status', title: 'Estado', type: 'status', width: 'w-32' },
        { id: 'col_start', title: 'Fecha Inicio', type: 'date', width: 'w-32' },
        { id: 'col_end', title: 'Fecha Final', type: 'date', width: 'w-32' },
        { id: 'col_duration', title: 'Duración', type: 'duration', width: 'w-24' },
        { id: 'col_resp', title: 'Responsable', type: 'text', width: 'w-40' },
      ];
    }

    const newBoard = {
      title,
      type, // 'project' o 'crm'
      createdAt: Date.now(),
      columns,
      rows: [] 
    };

    try {
      await addDoc(collection(db, 'argos_data', appId, 'boards'), newBoard);
    } catch (e) {
      alert("Error al crear: " + e.message);
    }
  };

  const deleteBoard = async (boardId) => {
    if(!confirm("¿Borrar esta tabla completa y todos sus datos? No se puede deshacer.")) return;
    await deleteDoc(doc(db, 'argos_data', appId, 'boards', boardId));
    if (activeBoardId === boardId) setActiveBoardId(null);
  };

  // --- GESTIÓN DE FILAS (ACTUALIZACIÓN) ---
  const updateBoardData = async (boardId, newData) => {
    if (!user) return;
    const boardRef = doc(db, 'argos_data', appId, 'boards', boardId);
    await updateDoc(boardRef, newData);
  };

  const addRow = async (board) => {
    const newRow = { id: generateId(), values: {}, comments: [] };
    const updatedRows = [...board.rows, newRow];
    await updateBoardData(board.id, { rows: updatedRows });
  };

  // NUEVA FUNCIÓN: Borrar fila individual
  const deleteRow = async (board, rowId) => {
    if (!isAdmin) return;
    if (!confirm("¿Borrar este elemento individualmente?")) return;
    
    const updatedRows = board.rows.filter(r => r.id !== rowId);
    await updateBoardData(board.id, { rows: updatedRows });
  };

  const updateCellValue = async (board, rowId, colId, value) => {
    const updatedRows = board.rows.map(row => {
      if (row.id === rowId) {
        return { ...row, values: { ...row.values, [colId]: value } };
      }
      return row;
    });
    await updateBoardData(board.id, { rows: updatedRows });
  };

  const addComment = async (board, rowId, text) => {
    const updatedRows = board.rows.map(row => {
      if (row.id === rowId) {
        const newComment = {
          id: generateId(),
          text,
          author: isAdmin ? "Administrador" : "Cliente",
          timestamp: Date.now()
        };
        return { ...row, comments: [...(row.comments || []), newComment] };
      }
      return row;
    });
    await updateBoardData(board.id, { rows: updatedRows });
  };

  // Filtrar tableros según la sección activa
  const projectBoards = boards.filter(b => b.type !== 'crm');
  const crmBoards = boards.filter(b => b.type === 'crm');
  
  const currentList = activeSection === 'crm' ? crmBoards : projectBoards;
  const activeBoard = boards.find(b => b.id === activeBoardId);

  // --- RENDERIZADO ---
  if (error) return <ErrorScreen error={error} />;
  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500 animate-pulse">Cargando Argos Solutions...</div>;

  return (
    <div className="flex h-screen bg-white font-sans text-sm overflow-hidden text-gray-800">
      
      {/* SIDEBAR */}
      <div className="w-64 bg-slate-900 text-white flex flex-col flex-shrink-0 border-r border-slate-700 z-20">
        <div className="p-4 border-b border-slate-700 bg-slate-800">
          <h1 className="font-bold text-lg flex items-center gap-2 text-blue-400">
            <Database size={20} />
            ARGOS
          </h1>
          <p className="text-xs text-slate-400 mt-1">Video Telemática & CRM</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          
          {/* SECCIÓN PROYECTOS */}
          <div>
            <div 
              className={`flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer ${activeSection === 'projects' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
              onClick={() => setActiveSection('projects')}
            >
              <Briefcase size={14} />
              PROYECTOS / TABLEROS
            </div>
            
            {activeSection === 'projects' && (
              <div className="mt-1 space-y-1 pl-2">
                {projectBoards.map(board => (
                  <div 
                    key={board.id}
                    onClick={() => setActiveBoardId(board.id)}
                    className={`group flex items-center justify-between px-3 py-2 rounded cursor-pointer transition-colors ${activeBoardId === board.id ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Layout size={14} />
                      <span className="truncate">{board.title}</span>
                    </div>
                    {isAdmin && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteBoard(board.id); }}
                        className="opacity-0 group-hover:opacity-100 hover:text-red-300 transition-opacity"
                        title="Borrar tabla completa"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {isAdmin && (
                  <button 
                    onClick={() => createNewBoard('project')}
                    className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 w-full rounded mt-2 transition-colors border border-dashed border-slate-700 text-xs"
                  >
                    <Plus size={12} /> Nueva Tabla
                  </button>
                )}
              </div>
            )}
          </div>

          {/* SECCIÓN CLIENTES (CRM) */}
          <div>
            <div 
              className={`flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer ${activeSection === 'crm' ? 'text-green-400' : 'text-slate-500 hover:text-slate-300'}`}
              onClick={() => setActiveSection('crm')}
            >
              <Users size={14} />
              CLIENTES (CRM)
            </div>

            {activeSection === 'crm' && (
              <div className="mt-1 space-y-1 pl-2">
                {crmBoards.map(board => (
                  <div 
                    key={board.id}
                    onClick={() => setActiveBoardId(board.id)}
                    className={`group flex items-center justify-between px-3 py-2 rounded cursor-pointer transition-colors ${activeBoardId === board.id ? 'bg-green-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <User size={14} />
                      <span className="truncate">{board.title}</span>
                    </div>
                    {isAdmin && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteBoard(board.id); }}
                        className="opacity-0 group-hover:opacity-100 hover:text-red-300 transition-opacity"
                        title="Borrar lista completa"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {isAdmin && (
                  <button 
                    onClick={() => createNewBoard('crm')}
                    className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 w-full rounded mt-2 transition-colors border border-dashed border-slate-700 text-xs"
                  >
                    <Plus size={12} /> Nuevo Listado
                  </button>
                )}
              </div>
            )}
          </div>

        </div>

        <div className="p-4 bg-slate-950 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Modo:</span>
            <span className={isAdmin ? 'text-green-400 font-bold' : 'text-blue-400 font-bold'}>
              {isAdmin ? 'ADMIN' : 'VISITA'}
            </span>
          </div>
          <button 
            onClick={handleRoleSwitch}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded text-xs transition-colors text-white ${isAdmin ? 'bg-red-900 hover:bg-red-800' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            {isAdmin ? <Unlock size={12} /> : <Lock size={12} />}
            {isAdmin ? 'Salir de Admin' : 'Entrar como Admin'}
          </button>
        </div>
      </div>

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
        {activeBoard ? (
          <>
            <div className="bg-white border-b px-6 py-4 shadow-sm flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${activeBoard.type === 'crm' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {activeBoard.type === 'crm' ? 'CRM' : 'Proyecto'}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-slate-800">{activeBoard.title}</h2>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="bg-white rounded-lg shadow border border-gray-200 min-w-max pb-10">
                {/* Cabecera */}
                <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                  <div className="w-10 p-3 border-r border-gray-100"></div>
                  {activeBoard.columns.map(col => (
                    <div key={col.id} className={`${col.width || 'w-40'} p-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-gray-100 flex-shrink-0`}>
                      {col.title}
                    </div>
                  ))}
                  <div className="w-20 p-3 text-xs font-bold text-gray-500 text-center uppercase border-r border-gray-100">Chat</div>
                  {isAdmin && <div className="w-10 p-3 text-xs font-bold text-gray-500 text-center uppercase">Del</div>}
                </div>

                {/* Filas */}
                {activeBoard.rows.map(row => (
                  <Row 
                    key={row.id} 
                    row={row} 
                    columns={activeBoard.columns} 
                    isAdmin={isAdmin}
                    onUpdate={(colId, val) => updateCellValue(activeBoard, row.id, colId, val)}
                    onOpenComments={() => setActiveCommentRow({ row, board: activeBoard })}
                    onDelete={() => deleteRow(activeBoard, row.id)}
                  />
                ))}

                {/* Botón Agregar Fila */}
                {isAdmin && (
                  <div className="flex border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => addRow(activeBoard)}>
                    <div className={`w-10 border-r border-gray-100 ${activeBoard.type === 'crm' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                    <div className="flex-1 p-2 pl-4 text-gray-500 flex items-center gap-2 hover:text-gray-700 text-sm">
                      <Plus size={16} />
                      <span>Agregar {activeBoard.type === 'crm' ? 'Cliente' : 'Elemento'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            {activeSection === 'crm' ? <Users size={48} className="mb-4 text-green-200" /> : <Layout size={48} className="mb-4 text-blue-200" />}
            <p className="text-lg font-medium text-gray-500">Sección {activeSection === 'crm' ? 'CLIENTES' : 'PROYECTOS'}</p>
            <p className="text-sm">Selecciona una tabla o crea una nueva.</p>
          </div>
        )}
      </div>

      {/* DRAWER COMENTARIOS */}
      {activeCommentRow && (
        <CommentDrawer 
          row={activeCommentRow.row}
          board={activeCommentRow.board}
          onClose={() => setActiveCommentRow(null)}
          onAddComment={(text) => addComment(activeCommentRow.board, activeCommentRow.row.id, text)}
        />
      )}
    </div>
  );
}

// --- PANTALLA DE ERROR ---
function ErrorScreen({ error }) {
  return (
    <div className="flex h-screen items-center justify-center bg-red-50 p-4">
      <div className="bg-white p-6 rounded shadow-lg max-w-md text-center">
        <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Error de Conexión</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Reintentar
        </button>
      </div>
    </div>
  );
}

// --- PANTALLA DE INSTRUCCIONES ---
function ConfigInstructions() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden">
        <div className="bg-blue-600 p-6 flex items-center gap-4">
          <Settings className="text-white w-10 h-10" />
          <div>
            <h1 className="text-2xl font-bold text-white">Configuración Necesaria</h1>
            <p className="text-blue-100">Argos Solution Manager</p>
          </div>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4">
            <p className="text-amber-800 font-medium">
              Aún no has configurado tu base de datos Firebase.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-gray-800 text-lg">Pasos para activar:</h3>
            <ol className="list-decimal list-inside space-y-3 text-gray-600">
              <li>Ve a la consola de Firebase.</li>
              <li>Copia SOLO las claves (apiKey, authDomain, etc).</li>
              <li>Pégalas en el archivo <code>src/App.jsx</code>.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- COMPONENTES AUXILIARES ---

function Row({ row, columns, isAdmin, onUpdate, onOpenComments, onDelete }) {
  return (
    <div className="flex border-b border-gray-100 group hover:bg-slate-50 transition-colors bg-white items-stretch">
      <div className="w-10 border-r border-gray-100 p-3 flex items-center justify-center bg-gray-50 group-hover:bg-gray-100">
        <div className="w-1.5 h-4 bg-slate-300 rounded-full group-hover:bg-blue-400 transition-colors"></div> 
      </div>
      
      {columns.map(col => (
        <div key={col.id} className={`${col.width || 'w-40'} border-r border-gray-100 flex-shrink-0`}>
          <Cell 
            type={col.type} 
            value={row.values[col.id]} 
            rowValues={row.values}
            isAdmin={isAdmin} 
            onChange={(val) => onUpdate(col.id, val)} 
          />
        </div>
      ))}
      
      <div className="w-20 border-r border-gray-100 flex items-center justify-center flex-shrink-0">
        <button onClick={onOpenComments} className={`p-2 rounded-full hover:bg-gray-100 ${row.comments?.length > 0 ? 'text-blue-500' : 'text-gray-300'}`}>
          <MessageSquare size={16} />
        </button>
      </div>

      {/* Botón de Borrar (Solo Admin) */}
      {isAdmin && (
        <div className="w-10 flex items-center justify-center flex-shrink-0">
          <button 
            onClick={onDelete}
            className="p-2 rounded-full text-gray-200 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Borrar fila"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function Cell({ type, value, rowValues, onChange, isAdmin }) {
  // CÁLCULO DE DURACIÓN
  if (type === 'duration') {
    const start = rowValues?.['col_start'];
    const end = rowValues?.['col_end'];
    let display = "-";
    let bgClass = "bg-gray-50 text-gray-400";

    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      const diffTime = endDate - startDate;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      if (diffDays < 0) {
        display = "Error";
        bgClass = "bg-red-100 text-red-600 font-bold";
      } else {
        display = `${diffDays} días`;
        bgClass = "bg-blue-100 text-blue-700 font-bold";
      }
    }
    return (
      <div className="h-full p-2 flex items-center justify-center">
        <div className={`px-2 py-1 rounded text-xs ${bgClass} flex items-center gap-1`}>
          <Clock size={10} />
          {display}
        </div>
      </div>
    );
  }

  // STATUS DE CRM
  if (type === 'crm_status') {
    const statusMap = {
      'new': { label: 'Prospecto', class: COLORS.crm.new },
      'contacted': { label: 'Contactado', class: COLORS.crm.contacted },
      'won': { label: 'Cerrado', class: COLORS.crm.won },
      'lost': { label: 'Perdido', class: COLORS.crm.lost },
      '': { label: '-', class: COLORS.status.default }
    };
    const current = statusMap[value] || statusMap[''];

    if (!isAdmin) return <div className={`m-1 h-8 flex items-center justify-center rounded text-xs font-bold ${current.class}`}>{current.label}</div>;

    return (
      <div className="p-1 h-full">
        <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={`w-full h-8 rounded text-center text-xs font-bold cursor-pointer ${current.class}`}>
          <option value="" className="bg-white text-gray-700">-</option>
          <option value="new" className="bg-blue-100 text-blue-800">Prospecto</option>
          <option value="contacted" className="bg-yellow-100 text-yellow-800">Contactado</option>
          <option value="won" className="bg-green-100 text-green-800">Cerrado (Ganado)</option>
          <option value="lost" className="bg-gray-200 text-gray-600">Perdido</option>
        </select>
      </div>
    );
  }

  // STATUS DE PROYECTOS
  if (type === 'status') {
    const statusMap = {
      'done': { label: 'Listo', class: COLORS.status.done },
      'working': { label: 'En Proceso', class: COLORS.status.working },
      'stuck': { label: 'Detenido', class: COLORS.status.stuck },
      '': { label: '-', class: COLORS.status.default }
    };
    const current = statusMap[value] || statusMap[''];

    if (!isAdmin) return <div className={`m-1 h-8 flex items-center justify-center rounded text-xs font-bold ${current.class}`}>{current.label}</div>;

    return (
      <div className="p-1 h-full">
        <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={`w-full h-8 rounded text-center text-xs font-bold cursor-pointer ${current.class}`}>
          <option value="" className="bg-white text-gray-700">-</option>
          <option value="done" className="bg-green-100 text-green-800">Listo</option>
          <option value="working" className="bg-orange-100 text-orange-800">En Proceso</option>
          <option value="stuck" className="bg-red-100 text-red-800">Detenido</option>
        </select>
      </div>
    );
  }

  if (type === 'date') {
    return (
      <div className="h-full p-1">
        {isAdmin ? (
          <input type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full h-full text-center text-xs text-gray-600 bg-transparent" />
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-gray-600">{value || '-'}</div>
        )}
      </div>
    );
  }

  return isAdmin ? (
    <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full h-full px-3 text-sm bg-transparent outline-none focus:bg-blue-50" placeholder="..." />
  ) : (
    <div className="w-full h-full px-3 flex items-center text-sm truncate" title={value}>{value}</div>
  );
}

function CommentDrawer({ row, onClose, onAddComment }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);
  
  const handleSend = (e) => { e.preventDefault(); if(text.trim()) { onAddComment(text); setText(""); }};
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [row.comments]);

  return (
    <div className="absolute top-0 right-0 h-full w-96 bg-white shadow-2xl border-l border-gray-200 flex flex-col z-30">
      <div className="p-4 border-b flex justify-between bg-gray-50">
        <h3 className="font-bold">Bitácora / Comentarios</h3>
        <button onClick={onClose}><X size={20} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
        {row.comments?.map(c => (
          <div key={c.id} className="bg-gray-100 p-3 rounded text-sm">
            <div className="flex justify-between mb-1"><span className="font-bold text-xs text-blue-600">{c.author}</span><span className="text-[10px] text-gray-400">{new Date(c.timestamp).toLocaleString()}</span></div>
            {c.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={handleSend} className="p-4 border-t bg-gray-50 flex gap-2">
        <input value={text} onChange={e=>setText(e.target.value)} className="flex-1 border p-2 rounded text-sm" placeholder="Escribir..." />
        <button type="submit" className="bg-blue-600 text-white p-2 rounded"><Send size={16}/></button>
      </form>
    </div>
  );
}