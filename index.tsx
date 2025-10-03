import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

// --- TYPE DEFINITIONS --- //
declare const Swal: any;
declare const Chart: any;

interface Memo {
  id: string;
  memoNumber: string;
  date: string;
  teacher: string;
  subject: string;
  department: string;
  fileData?: string;
  fileName?: string;
  fileType?: string;
}

type SortKey = keyof Memo | '';
type SortOrder = 'asc' | 'desc';

// --- HELPER FUNCTIONS --- //
const THEME_COLORS = ['#4A2C6D', '#D32F2F', '#F57C00', '#FBC02D', '#0288D1', '#388E3C'];

const getColorForString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash % THEME_COLORS.length);
  return THEME_COLORS[index];
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const formatDate = (dateString: string) => {
  try {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (e) {
    return 'Invalid Date';
  }
};

// --- SVG ICONS --- //
const icons = {
  add: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  stats: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10M18 20V4M6 20V16"/></svg>,
  edit: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  delete: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>,
  file: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>,
  close: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  back: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>,
  upload: <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--dark-gray)'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
};

// --- CUSTOM HOOKS --- //
const useLocalStorage = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
};

// --- COMPONENTS --- //
const Spinner: React.FC = () => (
  <div className="spinner-overlay">
    <div className="spinner"></div>
  </div>
);

const MemoModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (memo: Memo, file?: File) => void;
  memoToEdit?: Memo | null;
  departments: string[];
  onAddDepartment: (dept: string) => void;
}> = ({ isOpen, onClose, onSave, memoToEdit, departments, onAddDepartment }) => {
  const [memo, setMemo] = useState<Partial<Memo>>({});
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [newDepartment, setNewDepartment] = useState('');

  useEffect(() => {
    if (memoToEdit) {
      setMemo(memoToEdit);
      setFileName(memoToEdit.fileName || '');
    } else {
      setMemo({ id: `memo_${Date.now()}`, date: new Date().toISOString().split('T')[0] });
      setFileName('');
      setFile(null);
    }
  }, [memoToEdit, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setMemo({ ...memo, [e.target.name]: e.target.value });
  };
  
  const handleFileChange = (files: FileList | null) => {
    if (files && files[0]) {
      setFile(files[0]);
      setFileName(files[0].name);
    }
  };

  const handleDragEvents = (e: React.DragEvent<HTMLDivElement>, over: boolean) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(over);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      handleDragEvents(e, false);
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
          handleFileChange(files);
      }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (memo.memoNumber && memo.date && memo.teacher && memo.subject && memo.department) {
      onSave(memo as Memo, file || undefined);
    } else {
      Swal.fire('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกข้อมูลที่จำเป็นให้ครบ', 'warning');
    }
  };
  
  const handleAddDepartment = () => {
      if (newDepartment && !departments.includes(newDepartment)) {
        onAddDepartment(newDepartment);
        setMemo({...memo, department: newDepartment});
        setNewDepartment('');
      }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{memoToEdit ? 'แก้ไขบันทึกข้อความ' : 'เพิ่มบันทึกข้อความใหม่'}</h2>
          <button onClick={onClose} className="modal-close">{icons.close}</button>
        </div>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>เลขที่บันทึกข้อความ</label>
            <input type="text" name="memoNumber" value={memo.memoNumber || ''} onChange={handleChange} className="form-control" required/>
          </div>
          <div className="form-group">
            <label>วันที่</label>
            <input type="date" name="date" value={memo.date || ''} onChange={handleChange} className="form-control" required/>
          </div>
          <div className="form-group">
            <label>ชื่อครูผู้ดำเนินการ</label>
            <input type="text" name="teacher" value={memo.teacher || ''} onChange={handleChange} className="form-control" required/>
          </div>
          <div className="form-group">
            <label>เรื่อง</label>
            <input type="text" name="subject" value={memo.subject || ''} onChange={handleChange} className="form-control" required/>
          </div>
          <div className="form-group">
            <label>ฝ่ายงาน</label>
            <select name="department" value={memo.department || ''} onChange={handleChange} className="form-select" required>
              <option value="">เลือกฝ่ายงาน...</option>
              {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
            </select>
            <div className="department-management">
                <input 
                    type="text" 
                    value={newDepartment} 
                    onChange={(e) => setNewDepartment(e.target.value)}
                    className="form-control"
                    placeholder="เพิ่มฝ่ายงานใหม่"
                />
                <button type="button" onClick={handleAddDepartment} className="btn btn-primary" style={{width: 'auto'}}>{icons.add}</button>
            </div>
          </div>
          <div className="form-group">
            <label>ไฟล์เอกสาร</label>
            <div 
                className={`dropzone ${isDragging ? 'drag-over' : ''}`}
                onDragOver={(e) => handleDragEvents(e, true)}
                onDragLeave={(e) => handleDragEvents(e, false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input')?.click()}
            >
                {icons.upload}
                <p>ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</p>
                <input id="file-input" type="file" onChange={(e) => handleFileChange(e.target.files)} style={{ display: 'none' }} />
            </div>
            {fileName && <div className="file-preview">{icons.file} {fileName}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-danger" style={{backgroundColor: '#eee', color: '#333'}}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary">บันทึก</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const MainView: React.FC<{
    memos: Memo[];
    departments: string[];
    onAdd: () => void;
    onEdit: (memo: Memo) => void;
    onDelete: (id: string) => void;
}> = ({ memos, departments, onAdd, onEdit, onDelete }) => {
    const [filters, setFilters] = useState({ subject: '', teacher: '', department: '', startDate: '', endDate: '' });
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; order: SortOrder }>({ key: 'date', order: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const teachers = useMemo(() => [...new Set(memos.map(m => m.teacher))], [memos]);
    
    const filteredMemos = useMemo(() => {
        let filtered = memos.filter(memo => {
            const memoDate = new Date(memo.date);
            const startDate = filters.startDate ? new Date(filters.startDate) : null;
            const endDate = filters.endDate ? new Date(filters.endDate) : null;

            if(startDate) startDate.setHours(0,0,0,0);
            if(endDate) endDate.setHours(23,59,59,999);

            return (
                memo.subject.toLowerCase().includes(filters.subject.toLowerCase()) &&
                (filters.teacher === '' || memo.teacher === filters.teacher) &&
                (filters.department === '' || memo.department === filters.department) &&
                (!startDate || memoDate >= startDate) &&
                (!endDate || memoDate <= endDate)
            );
        });

        if (sortConfig.key) {
            filtered.sort((a, b) => {
                if (a[sortConfig.key]! < b[sortConfig.key]!) return sortConfig.order === 'asc' ? -1 : 1;
                if (a[sortConfig.key]! > b[sortConfig.key]!) return sortConfig.order === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [memos, filters, sortConfig]);

    const paginatedMemos = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredMemos.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredMemos, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredMemos.length / itemsPerPage);

    const handleSort = (key: SortKey) => {
        let order: SortOrder = 'asc';
        if (sortConfig.key === key && sortConfig.order === 'asc') {
            order = 'desc';
        }
        setSortConfig({ key, order });
    };

    const dashboardStats = useMemo(() => {
        const counts = departments.reduce((acc, dept) => ({ ...acc, [dept]: 0 }), {});
        filteredMemos.forEach(memo => {
            if (counts[memo.department] !== undefined) {
                counts[memo.department]++;
            }
        });
        return { total: filteredMemos.length, byDepartment: counts };
    }, [filteredMemos, departments]);

    return (
        <main className="container">
            <div className="dashboard">
                <div className="stat-card grad-1">
                    <h3>ทะเบียนทั้งหมด</h3>
                    <p>{dashboardStats.total}</p>
                    <span className="stat-card-icon">{icons.file}</span>
                </div>
                {departments.map((dept, i) => (
                    <div className={`stat-card grad-${(i % 4) + 2}`} key={dept}>
                        <h3>{dept}</h3>
                        <p>{dashboardStats.byDepartment[dept]}</p>
                         <span className="stat-card-icon">{icons.file}</span>
                    </div>
                ))}
            </div>
            
            <div className="card filters">
                <input type="text" placeholder="ค้นหาชื่อเรื่อง..." className="form-control" onChange={e => setFilters({...filters, subject: e.target.value})}/>
                <select className="form-select" onChange={e => setFilters({...filters, teacher: e.target.value})}>
                    <option value="">ครูผู้ดำเนินการทั้งหมด</option>
                    {teachers.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select className="form-select" onChange={e => setFilters({...filters, department: e.target.value})}>
                    <option value="">ฝ่ายงานทั้งหมด</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <input type="date" className="form-control" onChange={e => setFilters({...filters, startDate: e.target.value})} title="วันที่เริ่มต้น"/>
                <input type="date" className="form-control" onChange={e => setFilters({...filters, endDate: e.target.value})} title="วันที่สิ้นสุด"/>
            </div>

            <div className="card">
                <div className="table-container">
                    <table className="memo-table">
                        <thead>
                            <tr>
                                <th>ลำดับ</th>
                                <th onClick={() => handleSort('memoNumber')}>เลขที่บันทึก</th>
                                <th onClick={() => handleSort('date')}>วันที่</th>
                                <th onClick={() => handleSort('teacher')}>ชื่อครูผู้ดำเนินการ</th>
                                <th onClick={() => handleSort('subject')}>เรื่อง</th>
                                <th onClick={() => handleSort('department')}>ฝ่ายงาน</th>
                                <th>ไฟล์</th>
                                <th>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedMemos.map((memo, index) => (
                                <tr key={memo.id}>
                                    <td>{(currentPage - 1) * itemsPerPage + index + 1}</td>
                                    <td>{memo.memoNumber}</td>
                                    <td>{formatDate(memo.date)}</td>
                                    <td><span className="badge" style={{backgroundColor: getColorForString(memo.teacher)}}>{memo.teacher}</span></td>
                                    <td>{memo.subject}</td>
                                    <td><span className="badge" style={{backgroundColor: getColorForString(memo.department)}}>{memo.department}</span></td>
                                    <td>
                                        {memo.fileData && (
                                            <a href={memo.fileData} download={memo.fileName} className="btn btn-link" target="_blank" rel="noopener noreferrer">
                                                {icons.file} {memo.fileName?.substring(0,15)}...
                                            </a>
                                        )}
                                    </td>
                                    <td className="actions-cell">
                                        <button onClick={() => onEdit(memo)} className="btn btn-edit">{icons.edit}</button>
                                        <button onClick={() => onDelete(memo.id)} className="btn btn-danger">{icons.delete}</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                 <div className="pagination">
                    <span>หน้า {currentPage} จาก {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn">ก่อนหน้า</button>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn">ถัดไป</button>
                </div>
            </div>
        </main>
    );
};

const StatsView: React.FC<{ memos: Memo[], departments: string[] }> = ({ memos, departments }) => {
    const barChartRef = useRef<HTMLCanvasElement>(null);
    const lineChartRef = useRef<HTMLCanvasElement>(null);
    const [timeFilter, setTimeFilter] = useState('month');

    const createChart = useCallback((ctx, type, data, options) => {
        return new Chart(ctx, { type, data, options });
    }, []);

    useEffect(() => {
        const barCtx = barChartRef.current?.getContext('2d');
        if (!barCtx) return;

        const departmentCounts = departments.map(dept => memos.filter(m => m.department === dept).length);
        const chartData = {
            labels: departments,
            datasets: [{
                label: 'จำนวนบันทึกข้อความ',
                data: departmentCounts,
                backgroundColor: departments.map(dept => getColorForString(dept)),
                borderColor: departments.map(dept => getColorForString(dept)),
                borderWidth: 1
            }]
        };

        const chartInstance = createChart(barCtx, 'bar', chartData, {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        });

        return () => chartInstance.destroy();
    }, [memos, departments, createChart]);

    useEffect(() => {
        const lineCtx = lineChartRef.current?.getContext('2d');
        if (!lineCtx) return;
        
        const sortedMemos = [...memos].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const dataByTime: {[key: string]: number} = {};
        
        sortedMemos.forEach(memo => {
            const date = new Date(memo.date);
            let key = '';
            if (timeFilter === 'day') {
                key = date.toLocaleDateString('th-TH');
            } else if (timeFilter === 'month') {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            } else if (timeFilter === 'year') {
                key = String(date.getFullYear());
            }

            if(key) {
                dataByTime[key] = (dataByTime[key] || 0) + 1;
            }
        });
        
        const chartData = {
            labels: Object.keys(dataByTime),
            datasets: [{
                label: 'สถิติบันทึกข้อความ',
                data: Object.values(dataByTime),
                fill: true,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1
            }]
        };

        const chartInstance = createChart(lineCtx, 'line', chartData, {
            responsive: true,
            maintainAspectRatio: false,
        });

        return () => chartInstance.destroy();

    }, [memos, timeFilter, createChart]);

    return (
        <main className="container">
            <div className="stats-grid">
                <div className="card">
                    <h3>จำนวนบันทึกแต่ละฝ่ายงาน</h3>
                    <div className="chart-container"><canvas ref={barChartRef}></canvas></div>
                </div>
                 <div className="card">
                     <div className="stats-header" style={{marginBottom: "1rem"}}>
                        <h3>สถิติตามช่วงเวลา</h3>
                        <select value={timeFilter} onChange={e => setTimeFilter(e.target.value)} className="form-select" style={{width: "auto"}}>
                            <option value="day">รายวัน</option>
                            <option value="month">รายเดือน</option>
                            <option value="year">รายปี</option>
                        </select>
                     </div>
                    <div className="chart-container"><canvas ref={lineChartRef}></canvas></div>
                </div>
            </div>
        </main>
    )
};


// --- APP COMPONENT --- //
const App: React.FC = () => {
  const [memos, setMemos] = useLocalStorage<Memo[]>('memos', []);
  const [departments, setDepartments] = useLocalStorage<string[]>('departments', ['งานบริหารวิชาการ', 'งานบริหารงบประมาณ', 'งานบริหารบุคลากร', 'งานบริหารทั่วไป']);
  const [view, setView] = useState<'main' | 'stats'>('main');
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null);

  const handleSaveMemo = async (memo: Memo, file?: File) => {
    setLoading(true);
    try {
        let fileData, fileName, fileType;
        if (file) {
            fileData = await fileToBase64(file);
            fileName = file.name;
            fileType = file.type;
        } else if (editingMemo) {
            fileData = editingMemo.fileData;
            fileName = editingMemo.fileName;
            fileType = editingMemo.fileType;
        }

        const memoToSave = { ...memo, fileData, fileName, fileType };
        
        if (editingMemo) {
            setMemos(memos.map(m => m.id === memoToSave.id ? memoToSave : m));
        } else {
            setMemos([...memos, memoToSave]);
        }
        
        setIsModalOpen(false);
        setEditingMemo(null);
        Swal.fire('สำเร็จ!', 'บันทึกข้อมูลเรียบร้อยแล้ว', 'success');
    } catch (error) {
        console.error("Error saving memo: ", error);
        Swal.fire('ผิดพลาด!', 'เกิดข้อผิดพลาดในการบันทึกไฟล์', 'error');
    } finally {
        setLoading(false);
    }
  };

  const handleEdit = (memo: Memo) => {
    setEditingMemo(memo);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    Swal.fire({
      title: 'คุณแน่ใจหรือไม่?',
      text: "คุณจะไม่สามารถกู้คืนข้อมูลนี้ได้!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'ใช่, ลบเลย!',
      cancelButtonText: 'ยกเลิก'
    }).then((result: any) => {
      if (result.isConfirmed) {
        setLoading(true);
        setMemos(memos.filter(m => m.id !== id));
        setTimeout(() => {
            setLoading(false);
            Swal.fire('ลบแล้ว!', 'ข้อมูลถูกลบเรียบร้อยแล้ว', 'success');
        }, 500);
      }
    });
  };

  const handleAddNew = () => {
      setEditingMemo(null);
      setIsModalOpen(true);
  }

  const handleAddDepartment = (dept: string) => {
    if (dept && !departments.includes(dept)) {
        setDepartments([...departments, dept]);
    }
  };

  return (
    <>
      {loading && <Spinner />}
      <header className="app-header">
        <div className="container header-content">
          <h1 className="header-title">ทะเบียนคุมบันทึกข้อความ</h1>
          <div className="header-actions">
            {view === 'main' ? (
                <>
                <button className="btn btn-primary" onClick={handleAddNew}>{icons.add} เพิ่มบันทึกข้อความใหม่</button>
                <button className="btn btn-secondary" onClick={() => setView('stats')}>{icons.stats} ดูสถิติ</button>
                </>
            ) : (
                <button className="btn btn-secondary" onClick={() => setView('main')}>{icons.back} กลับหน้าแรก</button>
            )}
          </div>
        </div>
      </header>

      {view === 'main' ? (
        <MainView memos={memos} departments={departments} onAdd={handleAddNew} onEdit={handleEdit} onDelete={handleDelete} />
      ) : (
        <StatsView memos={memos} departments={departments} />
      )}
      
      <footer className="app-footer">
        ทะเบียนคุมบันทึกข้อความ โรงเรียน Art Kitthana
      </footer>

      <MemoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveMemo}
        memoToEdit={editingMemo}
        departments={departments}
        onAddDepartment={handleAddDepartment}
      />
    </>
  );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
