'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [classes, setClasses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [disabledSubjects, setDisabledSubjects] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initDone, setInitDone] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const savedGroups = localStorage.getItem('ehuntis_groups');
    const savedDisabled = localStorage.getItem('ehuntis_disabled_subjects');
    if (savedGroups) setSelectedGroups(JSON.parse(savedGroups));
    if (savedDisabled) setDisabledSubjects(JSON.parse(savedDisabled));
    setInitDone(true);
    
    // Fetch all available classes
    fetch('/api/classes')
      .then(res => res.json())
      .then(data => {
          if(!data.error) setClasses(data);
      })
      .catch(err => console.error("Error fetching classes", err));
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    if(initDone) localStorage.setItem('ehuntis_groups', JSON.stringify(selectedGroups));
  }, [selectedGroups, initDone]);

  useEffect(() => {
    if(initDone) localStorage.setItem('ehuntis_disabled_subjects', JSON.stringify(disabledSubjects));
  }, [disabledSubjects, initDone]);

  // Fetch timetable when groups change
  useEffect(() => {
    if (!initDone) return;
    if (selectedGroups.length === 0) {
      setTimetable([]);
      return;
    }
    
    setLoading(true);
    // Flatten the IDs since they are now arrays
    const classIds = selectedGroups.flatMap(g => Array.isArray(g.id) ? g.id : [g.id]).join(',');
    
    // By default fetches current week based on server time, but for testing we can hardcode 
    // a date where classes definitely exist (e.g. Sept/Oct). In production this should be the current date.
    const url = `/api/timetable?classIds=${classIds}`;
    
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (!data.error) setTimetable(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedGroups, initDone]);

  // Filter out disabled subjects
  const filteredTimetable = timetable.filter(lesson => 
    !lesson.subjectIds.some(id => disabledSubjects.includes(id))
  );

  // Extract all unique subjects from the timetable for the toggle list
  const uniqueSubjects = [];
  timetable.forEach(lesson => {
    lesson.subjects.forEach((subjName, idx) => {
      const subjId = lesson.subjectIds[idx];
      if (!uniqueSubjects.find(s => s.id === subjId)) {
        uniqueSubjects.push({ id: subjId, name: subjName });
      }
    });
  });

  const addGroup = (c) => {
    if (!selectedGroups.find(g => (g.uniqueId && g.uniqueId === c.uniqueId) || (g.id === c.id))) {
      setSelectedGroups([...selectedGroups, c]);
    }
    setSearchTerm('');
  };

  const removeGroup = (itemToRemove) => {
    setSelectedGroups(selectedGroups.filter(g => {
        if (itemToRemove.uniqueId) return g.uniqueId !== itemToRemove.uniqueId;
        return g.id !== itemToRemove.id;
    }));
  };

  const toggleSubject = (id) => {
    if (disabledSubjects.includes(id)) {
      setDisabledSubjects(disabledSubjects.filter(subId => subId !== id));
    } else {
      setDisabledSubjects([...disabledSubjects, id]);
    }
  };

  // Group timetable by date (YYYYMMDD)
  const groupedTimetable = filteredTimetable.reduce((acc, lesson) => {
    if (!acc[lesson.date]) acc[lesson.date] = [];
    acc[lesson.date].push(lesson);
    return acc;
  }, {});

  if (!initDone) return <div className="p-8">Cargando...</div>;

  return (
    <div className="p-8 font-sans max-w-7xl mx-auto bg-gray-50 min-h-screen text-gray-900">
      <h1 className="text-4xl font-extrabold mb-8 text-blue-950 tracking-tight">EHUntis <span className="text-blue-500 font-normal">| Horarios EHU</span></h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Panel Izquierdo: Selección */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm">
            <h2 className="text-xl font-bold mb-2 text-gray-800">1. Añadir Grupos</h2>
            <p className="text-sm text-gray-500 mb-4">Busca tu titulación o grupo (ej. Informática, Medicina, GII...).</p>
            
            <div className="relative">
              <input 
                type="text" 
                placeholder="🔍 Buscar grupo..."
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg mb-2 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              
              {searchTerm.length > 2 && (
                <ul className="absolute z-10 w-full max-h-60 overflow-y-auto border border-gray-200 bg-white rounded-lg shadow-xl top-14 left-0">
                  {(() => {
                    const normalizeStr = (str) => {
                        if (!str) return '';
                        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                    };
                    const searchTerms = normalizeStr(searchTerm).split(/[\s-]+/).filter(t => t.length > 0);
                    
                    const filteredClasses = classes.filter(c => {
                        const text = normalizeStr((c.longName || '') + ' ' + (c.name || ''));
                        return searchTerms.every(term => text.includes(term));
                    });

                    if (filteredClasses.length === 0) {
                        return <li className="p-3 text-sm text-gray-500">No hay resultados</li>;
                    }

                    return filteredClasses.slice(0, 20).map(c => (
                        <li 
                          key={c.uniqueId || c.id} 
                          className="p-3 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-0"
                          onClick={() => addGroup(c)}
                        >
                          <div className="font-semibold text-gray-800">{c.longName || c.name}</div>
                          {c.longName && c.name && <div className="text-xs text-gray-500">{c.name}</div>}
                        </li>
                    ));
                  })()}
                </ul>
              )}
            </div>

            <div className="mt-6">
              <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider mb-3">Tus Grupos Seleccionados:</h3>
              {selectedGroups.length === 0 && <p className="text-sm text-gray-400 italic">No has añadido ningún grupo.</p>}
              <div className="space-y-2">
                {selectedGroups.map(g => (
                  <div key={g.uniqueId || g.id} className="flex justify-between items-center bg-blue-50/50 p-3 rounded-lg border border-blue-100 text-sm font-medium text-blue-900 group transition-all hover:bg-blue-100/50">
                    <div className="flex flex-col overflow-hidden pr-2">
                        <span className="font-semibold truncate">{g.longName || g.name}</span>
                        {g.longName && g.name && <span className="text-xs opacity-75 truncate">{g.name}</span>}
                    </div>
                    <button onClick={() => removeGroup(g)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors" title="Eliminar grupo">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm">
            <h2 className="text-xl font-bold mb-2 text-gray-800">2. Filtrar Asignaturas</h2>
            <p className="text-sm text-gray-500 mb-4">Desmarca las asignaturas que no curses (ej. optativas, otros idiomas o laboratorios).</p>
            
            {uniqueSubjects.length === 0 ? (
                <div className="text-center p-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <p className="text-sm text-gray-400">Añade un grupo para ver sus asignaturas aquí.</p>
                </div>
            ) : (
                <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {uniqueSubjects.map(subj => (
                    <label key={subj.id} className={`flex items-start space-x-3 text-sm cursor-pointer p-2.5 rounded-lg transition-colors ${!disabledSubjects.includes(subj.id) ? 'hover:bg-blue-50/50' : 'opacity-60 hover:bg-gray-50'}`}>
                    <div className="flex items-center h-5">
                        <input 
                        type="checkbox" 
                        checked={!disabledSubjects.includes(subj.id)}
                        onChange={() => toggleSubject(subj.id)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                    </div>
                    <span className={`font-medium ${!disabledSubjects.includes(subj.id) ? 'text-gray-700' : 'text-gray-400 line-through'}`}>{subj.name}</span>
                    </label>
                ))}
                </div>
            )}
          </div>

        </div>

        {/* Panel Derecho: Horario */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm min-h-[600px]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Tu Horario</h2>
                {loading && (
                    <span className="inline-flex items-center text-sm text-blue-600 font-medium px-3 py-1 bg-blue-50 rounded-full">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Actualizando...
                    </span>
                )}
              </div>
              
              {!loading && Object.keys(groupedTimetable).length === 0 && selectedGroups.length > 0 && (
                <div className="text-center py-20">
                    <p className="text-gray-500 text-lg">No hay clases programadas para esta semana o todas han sido filtradas.</p>
                </div>
              )}
              
              {!loading && selectedGroups.length === 0 && (
                <div className="text-center py-20 flex flex-col items-center">
                    <div className="text-6xl mb-4">📅</div>
                    <p className="text-gray-500 text-lg max-w-md">Busca y añade tu grupo en el panel izquierdo para generar tu horario personalizado.</p>
                </div>
              )}

              <div className="space-y-8">
                {Object.keys(groupedTimetable).sort().map(date => {
                  const lessons = groupedTimetable[date].sort((a, b) => a.startTime - b.startTime);
                  
                  // Parse date
                  const year = date.substring(0,4);
                  const month = date.substring(4,6);
                  const day = date.substring(6,8);
                  const dateObj = new Date(year, parseInt(month)-1, day);
                  
                  const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                  
                  const dayName = daysOfWeek[dateObj.getDay()];
                  const formattedDate = `${dayName}, ${day} ${months[dateObj.getMonth()]} ${year}`;
                  
                  return (
                    <div key={date} className="relative">
                      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm py-2 mb-3 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-700 flex items-center">
                            <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                            {formattedDate}
                        </h3>
                      </div>
                      
                      <div className="space-y-3">
                        {lessons.map((lesson, idx) => {
                          const startHour = Math.floor(lesson.startTime / 100);
                          const startMin = (lesson.startTime % 100).toString().padStart(2, '0');
                          const endHour = Math.floor(lesson.endTime / 100);
                          const endMin = (lesson.endTime % 100).toString().padStart(2, '0');
                          
                          const isCancelled = lesson.code === 'cancelled';
                          
                          return (
                            <div key={`${lesson.id}-${idx}`} className={`flex rounded-xl overflow-hidden border ${isCancelled ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow'}`}>
                              {/* Timeline color accent */}
                              <div className={`w-1.5 ${isCancelled ? 'bg-red-400' : 'bg-blue-500'}`}></div>
                              
                              {/* Time block */}
                              <div className="w-28 bg-gray-50 border-r border-gray-100 p-4 flex flex-col justify-center items-center text-center">
                                <span className="text-sm font-bold text-gray-700">{startHour}:{startMin}</span>
                                <span className="text-xs text-gray-400 my-0.5">hasta</span>
                                <span className="text-sm font-bold text-gray-700">{endHour}:{endMin}</span>
                              </div>
                              
                              {/* Details block */}
                              <div className="p-4 flex-1">
                                <div className="flex items-start justify-between mb-1">
                                    <h4 className={`font-bold text-lg leading-tight ${isCancelled ? 'text-red-700 line-through' : 'text-blue-950'}`}>
                                      {lesson.subjects.join(' / ') || 'Sin Asignatura'}
                                    </h4>
                                    {isCancelled && <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ml-2 shrink-0">Cancelada</span>}
                                </div>
                                
                                <div className="flex flex-wrap gap-4 mt-2">
                                    <div className="flex items-center text-sm text-gray-600">
                                        <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                        {lesson.rooms.join(' / ') || 'Sin Aula'}
                                    </div>
                                    <div className="flex items-center text-sm text-gray-600">
                                        <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                        {lesson.teachers.join(' / ') || 'Sin Profesor'}
                                    </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
          </div>
        </div>

      </div>
    </div>
  );
}
