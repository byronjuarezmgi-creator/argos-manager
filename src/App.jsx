import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, onSnapshot, 
  addDoc, updateDoc, deleteDoc, setDoc, 
  serverTimestamp, query 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, 
  signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Plus, MessageSquare, Trash2, MoreHorizontal, 
  Calendar, CheckCircle, AlertCircle, Clock, 
  Layout, Search, User, ChevronRight, X, Send,
  Settings, Database
} from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE ---
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC5p3Hs08DRmoZ-TORtAOdyO7NYoU5PsDY",
  authDomain: "argos-solution.firebaseapp.com",
  projectId: "argos-solution",
  storageBucket: "argos-solution.firebasestorage.app",
  messagingSenderId: "247770655042",
  appId: "1:247770655042:web:def64655d90e5c12e1c0db",
  measurementId: "G-T2MBMQ769S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// --- UTILIDADES ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const COLORS = {
  status: {
    done: 'bg-green-400 text-white',
    working: 'bg-orange-400 text-white',
    stuck: 'bg-red-400 text-white',
    default: 'bg-gray-300 text-gray-700'
  },
  priority: {
    high: 'bg-purple-500 text-white',
    medium: 'bg-blue-400 text-white',
    low: 'bg-sky-200 text-sky-800',
    default: 'bg-gray-200 text-gray-600'
  }
};

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [user, setUser] = useState(null);
  const [boards, setBoards] = useState([]);
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(true); // Simula el modo Admin vs Vista Cliente
  const [loading, setLoading] = useState(true);
  
  // Panel de comentarios
  const [activeCommentRow, setActiveCommentRow] = useState(null);

  // --- AUTENTICACIÓN ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // --- CARGA DE DATOS ---
  useEffect(() => {
    if (!user) return;

    // Usamos una colección pública para que todos vean lo mismo en este demo colaborativo
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'argos_boards');
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedBoards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Ordenar en memoria (evitando orderBy compuesto)
      loadedBoards.sort((a, b) => a.createdAt - b.createdAt);

      if (loadedBoards.length === 0) {
        createDefaultBoard(); // Crear datos de ejemplo si está vacío
      } else {
        setBoards(loadedBoards);
        if (!activeBoardId && loadedBoards.length > 0) {
          setActiveBoardId(loadedBoards[0].id);
        }
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching boards:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // --- LÓGICA DE TABLEROS ---
  const createDefaultBoard = async () => {
    if (!user) return;
    const defaultBoard = {
      title: "Implementación Argos - Fase 1",
      createdAt: Date.now(),
      columns: [
        { id: 'col_item', title: 'Elemento / Tarea', type: 'text', width: 'w-1/3' },
        { id: 'col_status', title: 'Estado', type: 'status', width: 'w-32' },
        { id: 'col_date', title: 'Fecha Límite', type: 'date', width: 'w-32' },
        { id: 'col_person', title: 'Responsable', type: 'text', width: 'w-40' },
      ],
      rows: [
        { 
          id: generateId(), 
          values: { 
            col_item: "Instalación de Cámaras MDVR - Flota A", 
            col_status: "working", 
            col_date: "2024-10-25", 
            col_person: "Tec. Juan Perez" 
          },
          comments: []
        },
        { 
          id: generateId(), 
          values: { 
            col_item: "Configuración Servidor Argos", 
            col_status: "done", 
            col_date: "2024-10-20", 
            col_person: "Ing. Sistemas" 
          },
          comments: [
            { id: 1, text: "Servidor configurado y activo.", author: "Ing. Sistemas", timestamp: Date.now() }
          ]
        },
        { 
          id: generateId(), 
          values: { 
            col_item: "Pruebas de Campo (Streaming)", 
            col_status: "stuck", 
            col_date: "2024-10-26", 
            col_person: "Tec. Maria L." 
          },
          comments: []
        }
      ]
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'argos_boards'), defaultBoard);
    } catch (e) {
      console.error("Error creating default board", e);
    }
  };

  const createNewBoard = async () => {
    const title = prompt("Nombre de la nueva tabla (Ej: Tareas Diarias):");
    if (!title || !user) return;

    const newBoard = {
      title,
      createdAt: Date.now(),
      columns: [
        { id: 'col_item', title: 'Tarea', type: 'text', width: 'w-1/3' },
        { id: 'col_status', title: 'Estado', type: 'status', width: 'w-32' },
      ],
      rows: []
    };
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'argos_boards'), newBoard);
  };

  const deleteBoard = async (boardId) => {
    if(!confirm("¿Borrar esta tabla permanentemente?")) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'argos_boards', boardId));
    if (activeBoardId === boardId) setActiveBoardId(null);
  };

  // --- LÓGICA DE ACTUALIZACIÓN ---
  const updateBoardData = async (boardId, newData) => {
    if (!user) return;
    const boardRef = doc(db, 'artifacts', appId, 'public', 'data', 'argos_boards', boardId);
    await updateDoc(boardRef, newData);
  };

  const addRow = async (board) => {
    const newRow = { id: generateId(), values: {}, comments: [] };
    const updatedRows = [...board.rows, newRow];
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
          author: isAdmin ? "Administrador" : "Cliente/Visita",
          timestamp: Date.now()
        };
        return { ...row, comments: [...(row.comments || []), newComment] };
      }
      return row;
    });
    await updateBoardData(board.id, { rows: updatedRows });
  };

  const activeBoard = boards.find(b => b.id === activeBoardId);

  // --- RENDERIZADO ---
  if (loading) return <div className="flex items-center justify-center h-screen bg-gray-50 text-gray-500">Cargando Argos Solutions...</div>;

  return (
    <div className="flex h-screen bg-white font-sans text-sm overflow-hidden">
      
      {/* SIDEBAR (Lista de Tablas) */}
      <div className="w-64 bg-slate-900 text-white flex flex-col flex-shrink-0 border-r border-slate-700 shadow-xl z-20">
        <div className="p-4 border-b border-slate-700 bg-slate-800">
          <h1 className="font-bold text-lg flex items-center gap-2 text-blue-400">
            <Database size={20} />
            ARGOS SOLUTION
          </h1>
          <p className="text-xs text-slate-400 mt-1">Video Telemática</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase px-2 py-2">Tableros de Proyecto</div>
          {boards.map(board => (
            <div 
              key={board.id}
              onClick={() => setActiveBoardId(board.id)}
              className={`group flex items-center justify-between px-3 py-2 rounded cursor-pointer transition-colors ${activeBoardId === board.id ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 text-slate-300'}`}
            >
              <div className="flex items-center gap-2 truncate">
                <Layout size={14} />
                <span className="truncate">{board.title}</span>
              </div>
              {isAdmin && (
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteBoard(board.id); }}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-300 transition-opacity"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}

          {isAdmin && (
            <button 
              onClick={createNewBoard}
              className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 w-full rounded mt-2 transition-colors"
            >
              <Plus size={14} />
              <span>Nueva Tabla</span>
            </button>
          )}
        </div>

        {/* Control de Roles Simulado */}
        <div className="p-4 bg-slate-950 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Modo actual:</span>
            <span className={isAdmin ? 'text-green-400 font-bold' : 'text-blue-400 font-bold'}>
              {isAdmin ? 'ADMIN (Editar)' : 'CLIENTE (Ver)'}
            </span>
          </div>
          <button 
            onClick={() => setIsAdmin(!isAdmin)}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded text-xs transition-colors"
          >
            <User size={12} />
            Cambiar Rol
          </button>
        </div>
      </div>

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
        {/* Header de Tabla */}
        {activeBoard ? (
          <>
            <div className="bg-white border-b px-6 py-4 shadow-sm flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{activeBoard.title}</h2>
                <p className="text-gray-500 text-xs mt-1">Gestione el progreso, pruebas de campo y tareas.</p>
              </div>
              <div className="flex gap-2">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs border-2 border-white">YO</div>
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs border-2 border-white">CL</div>
                </div>
                <button className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-medium border border-blue-100">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  En línea
                </button>
              </div>
            </div>

            {/* Grid / Tabla */}
            <div className="flex-1 overflow-auto p-6">
              <div className="bg-white rounded-lg shadow border border-gray-200 min-w-max">
                {/* Cabecera Columnas */}
                <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                  <div className="w-10 p-3 border-r border-gray-100 flex-shrink-0"></div> {/* Checkbox/Color placeholder */}
                  {activeBoard.columns.map(col => (
                    <div key={col.id} className={`${col.width || 'w-40'} p-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-gray-100 flex items-center gap-2 flex-shrink-0`}>
                      {col.title}
                    </div>
                  ))}
                  <div className="w-20 p-3 text-xs font-bold text-gray-500 text-center uppercase border-r border-gray-100 flex-shrink-0">
                    Coment.
                  </div>
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
                  />
                ))}

                {/* Botón Nueva Fila */}
                {isAdmin && (
                  <div className="flex border-t border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="w-10 border-r border-gray-100 flex-shrink-0 bg-blue-500"></div>
                    <button 
                      onClick={() => addRow(activeBoard)}
                      className="flex-1 p-2 text-left text-gray-500 flex items-center gap-2 hover:text-blue-600 pl-4 text-sm"
                    >
                      <Plus size={16} />
                      <span>Agregar Elemento</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <Layout size={48} className="mb-4 text-gray-300" />
            <p>Selecciona o crea una tabla para comenzar</p>
          </div>
        )}
      </div>

      {/* SIDEBAR DE COMENTARIOS (Drawer) */}
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

// --- SUB-COMPONENTES ---

function Row({ row, columns, isAdmin, onUpdate, onOpenComments }) {
  return (
    <div className="flex border-b border-gray-100 group hover:bg-blue-50/30 transition-colors bg-white">
      <div className="w-10 border-r border-gray-100 p-3 flex items-center justify-center flex-shrink-0 bg-gray-50 group-hover:bg-blue-100 transition-colors">
        <div className="w-1.5 h-full bg-blue-500 rounded-full"></div> 
      </div>
      
      {columns.map(col => (
        <div key={col.id} className={`${col.width || 'w-40'} border-r border-gray-100 relative flex-shrink-0`}>
          <Cell 
            type={col.type} 
            value={row.values[col.id]} 
            isAdmin={isAdmin}
            onChange={(val) => onUpdate(col.id, val)} 
          />
        </div>
      ))}
      
      <div className="w-20 border-r border-gray-100 flex items-center justify-center flex-shrink-0">
        <button 
          onClick={onOpenComments}
          className={`relative p-2 rounded-full hover:bg-gray-100 transition-colors ${row.comments?.length > 0 ? 'text-blue-500' : 'text-gray-300'}`}
        >
          <MessageSquare size={18} />
          {row.comments?.length > 0 && (
            <span className="absolute top-0 right-0 bg-blue-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full">
              {row.comments.length}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

function Cell({ type, value, onChange, isAdmin }) {
  if (type === 'status') {
    const statusMap = {
      'done': { label: 'Listo', class: COLORS.status.done },
      'working': { label: 'En Proceso', class: COLORS.status.working },
      'stuck': { label: 'Detenido', class: COLORS.status.stuck },
      '': { label: '-', class: COLORS.status.default }
    };
    const current = statusMap[value] || statusMap[''];

    if (!isAdmin) {
      return (
        <div className="h-full w-full p-1 flex items-center justify-center">
          <span className={`w-full h-8 flex items-center justify-center text-xs font-semibold rounded ${current.class}`}>
            {current.label}
          </span>
        </div>
      );
    }

    return (
      <div className="h-full w-full p-1">
        <select 
          value={value || ''} 
          onChange={(e) => onChange(e.target.value)}
          className={`w-full h-8 text-center text-xs font-semibold rounded appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-blue-300 transition-all ${current.class}`}
        >
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
      <div className="h-full w-full p-1 flex items-center justify-center group">
        {isAdmin ? (
          <input 
            type="date" 
            value={value || ''} 
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-full text-center bg-transparent text-gray-600 text-xs focus:bg-white focus:outline-none rounded"
          />
        ) : (
          <span className="text-gray-600 text-xs">{value || '-'}</span>
        )}
      </div>
    );
  }

  // Default Text
  if (!isAdmin) {
    return (
      <div className="h-full w-full px-3 flex items-center text-sm text-gray-700 truncate" title={value}>
        {value}
      </div>
    );
  }

  return (
    <input 
      type="text" 
      value={value || ''} 
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-full px-3 bg-transparent hover:bg-gray-50 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-400 focus:outline-none text-sm text-gray-700 transition-all"
      placeholder="..."
    />
  );
}

function CommentDrawer({ row, board, onClose, onAddComment }) {
  const [text, setText] = useState("");
  const messagesEndRef = useRef(null);
  
  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAddComment(text);
    setText("");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [row.comments]);

  return (
    <div className="absolute top-0 right-0 h-full w-96 bg-white shadow-2xl border-l border-gray-200 flex flex-col z-30 transform transition-transform duration-300">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <h3 className="font-bold text-gray-700 flex items-center gap-2">
          <MessageSquare size={16} className="text-blue-500" />
          Historial de Actualizaciones
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
      </div>

      <div className="p-4 bg-blue-50 border-b border-blue-100">
        <p className="text-xs font-bold text-blue-600 uppercase mb-1">Elemento:</p>
        <p className="text-sm text-gray-800 line-clamp-2 font-medium">
          {row.values['col_item'] || "(Sin nombre)"}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
        {row.comments && row.comments.length > 0 ? (
          row.comments.map(c => (
            <div key={c.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold flex-shrink-0">
                {c.author.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-bold text-xs text-gray-800">{c.author}</span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(c.timestamp).toLocaleString([], { hour: '2-digit', minute:'2-digit', day:'numeric', month:'short' })}
                  </span>
                </div>
                <div className="bg-gray-100 p-2.5 rounded-br-lg rounded-bl-lg rounded-tr-lg text-sm text-gray-700 leading-relaxed shadow-sm">
                  {c.text}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10 text-gray-400 text-sm">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-20" />
            No hay comentarios aún.
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="relative">
          <input 
            type="text" 
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe una actualización..."
            className="w-full pl-4 pr-12 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm text-sm"
          />
          <button 
            type="submit" 
            disabled={!text.trim()}
            className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}