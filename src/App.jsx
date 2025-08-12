import React, { useState, useRef, useEffect, createContext, useContext } from "react";
import { Modal, Input, Select, Checkbox, Button, Tooltip } from "antd";
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import dayjs from "dayjs";
import { nanoid } from "nanoid";



const CATEGORIES = [
  { label: "To Do", value: "todo", color: "#eab308" },
  { label: "In Progress", value: "progress", color: "#4f46e5" },
  { label: "Review", value: "review", color: "#06b6d4" },
  { label: "Completed", value: "completed", color: "#16a34a" }
];
const FILTERS = [
  { label: "1 Week", value: 7 },
  { label: "2 Weeks", value: 14 },
  { label: "3 Weeks", value: 21 }
];

const today = dayjs().startOf("day");


function getMonthDays(year, month) {
 
  const start = dayjs().year(year).month(month).startOf("month");
  const days = [];
  let d = start;
  while (d.month() === month) {
    days.push(d);
    d = d.add(1, "day");
  }
  return days;
}

function dateInRange(date, start, end) {
  return dayjs(date).isSameOrAfter(dayjs(start), 'day') &&
         dayjs(date).isSameOrBefore(dayjs(end), 'day');
}

function isToday(date) {
  return dayjs(date).isSame(today, 'day');
}


const TaskContext = createContext();
function useTasks() { return useContext(TaskContext); }


export default function App() {
 
  const [month, setMonth] = useState(dayjs().month());
  const [year, setYear] = useState(dayjs().year());
  const days = getMonthDays(year, month);

  
  const [tasks, setTasks] = useState(() => {
    const persisted = localStorage.getItem("tasks");
    return persisted ? JSON.parse(persisted) : [];
  });

  useEffect(() => { localStorage.setItem("tasks", JSON.stringify(tasks)); }, [tasks]);

 
  const [catFilters, setCatFilters] = useState([]);
  const [durationFilter, setDurationFilter] = useState();
  const [search, setSearch] = useState("");


  const [modal, setModal] = useState({ open: false, range: null, editId: null });

  const [selecting, setSelecting] = useState({ on: false, startIdx: null, endIdx: null });


  let filteredTasks = tasks.filter(task => {
  
    if (catFilters.length && !catFilters.includes(task.category)) return false;
   
    if (durationFilter) {
      const dur = dayjs(task.end).diff(dayjs(task.start), "day") + 1;
      if (dur > durationFilter) return false;
    }
  
    if (search.trim() && !task.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

 
  function handleModalOk(name, category) {
    if (modal.editId) {
      setTasks(ts => ts.map(t => t.id === modal.editId ? { ...t, name, category } : t));
    } else if (modal.range) {
      const [from, to] = [modal.range.start, modal.range.end].sort((a, b) => a - b);
      setTasks(ts => [
        ...ts,
        {
          id: nanoid(),
          name,
          category,
          start: days[from].format("YYYY-MM-DD"),
          end: days[to].format("YYYY-MM-DD"),
        }
      ]);
    }
    setModal({ open: false, range: null, editId: null });
  }


  function onDayMouseDown(idx) {
    setSelecting({ on: true, startIdx: idx, endIdx: idx });
  }
  function onDayMouseEnter(idx) {
    if (selecting.on) setSelecting(s => ({ ...s, endIdx: idx }));
  }
  function onDayMouseUp() {
    if (selecting.on) {
      setModal({ open: true, range: { start: selecting.startIdx, end: selecting.endIdx }, editId: null });
      setSelecting({ on: false, startIdx: null, endIdx: null });
    }
  }

  
  const [draggingTask, setDraggingTask] = useState(null);

  function handleDragStart(event) {
    setDraggingTask(event.active.id);
  }
  function handleDragEnd(event) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const sourceTask = tasks.find(t => t.id === active.id);
      const newDate = over.id; 
    
      const duration = dayjs(sourceTask.end).diff(dayjs(sourceTask.start), "day");
      const newStart = dayjs(newDate);
      const newEnd = newStart.add(duration, "day");
      setTasks(ts => ts.map(t =>
        t.id === sourceTask.id
          ? { ...t, start: newStart.format("YYYY-MM-DD"), end: newEnd.format("YYYY-MM-DD") }
          : t
      ));
    }
    setDraggingTask(null);
  }

  // Task stretching (resize edges)
  function handleStretch(taskId, dir, date) {
    setTasks(ts => ts.map(t => {
      if (t.id !== taskId) return t;
      if (dir === "left") {
        if (dayjs(date).isAfter(dayjs(t.end))) return t;
        return { ...t, start: dayjs(date).format("YYYY-MM-DD") };
      }
      if (dir === "right") {
        if (dayjs(date).isBefore(dayjs(t.start))) return t;
        return { ...t, end: dayjs(date).format("YYYY-MM-DD") };
      }
      return t;
    }));
  }

  function handleDelete(taskId) {
    setTasks(ts => ts.filter(t => t.id !== taskId));
  }

  // For navigation (bonus)
  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
  }

  // Provide tasks and events in context
  return (
    <TaskContext.Provider value={{
      tasks, setTasks, filteredTasks, handleDelete, handleStretch,
      setModal, modal, handleModalOk, setCatFilters, setDurationFilter, setSearch,
      catFilters, durationFilter, search, CATEGORIES, FILTERS,
    }}>
      <div style={{ fontFamily: "sans-serif", background: "#f6f6f6", minHeight: "100vh" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          maxWidth: 1100, margin: "0 auto", padding: "2rem 1rem 1rem"
        }}>
          <h2 style={{ fontWeight: 700, fontSize: 28, margin: 0 }}>Month Task Planner</h2>
          <div>
            <Button style={{ marginRight: 8 }} onClick={prevMonth}>Prev</Button>
            <Button onClick={nextMonth}>Next</Button>
          </div>
        </div>

        {/* Filter/search */}
        <FilterPanel />

        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <MonthCalendar
            days={days}
            selecting={selecting}
            onDayMouseDown={onDayMouseDown}
            onDayMouseEnter={onDayMouseEnter}
            onDayMouseUp={onDayMouseUp}
            draggingTask={draggingTask}
          />
        </DndContext>

        <TaskModal
          visible={modal.open}
          onOk={handleModalOk}
          onCancel={() => setModal({ open: false, range: null, editId: null })}
          days={days}
          modal={modal}
          tasks={tasks}
        />
      </div>
    </TaskContext.Provider>
  );
}

//////////////// Month Calendar ////////////////
function MonthCalendar({
  days, selecting, onDayMouseDown, onDayMouseEnter, onDayMouseUp, draggingTask
}) {
  // Build grid (start day offset)
  const startDay = days[0].day(); // 0=Sun
  const gridDays = [...Array(startDay).fill(null), ...days];

  // Per day, gather tasks whose bar includes this day
  const { filteredTasks } = useTasks();

  return (
    <div
      style={{
        maxWidth: 1100, margin: "0 auto", background: "#fff", boxShadow: "0 4px 24px #0001",
        borderRadius: 12, padding: 16,
      }}>
      <div
        style={{
          display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "2px",
        }}>
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d =>
          <div key={d} style={{
            fontWeight: 600, padding: 4, background: "#f3f4f6", borderRadius: 4, textAlign: "center",
            marginBottom: 6
          }}>{d}</div>
        )}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7,1fr)",
          gridAutoRows: "70px",
          gap: "2px",
          minHeight: 420,
          borderRadius: 8,
        }}>
        {gridDays.map((day, idx) =>
          day
            ? (
              <CalendarDay
                key={day.format("YYYY-MM-DD")}
                day={day}
                tasks={filteredTasks.filter(t => dateInRange(day, t.start, t.end))}
                selecting={selecting}
                idx={idx - startDay}
                onDayMouseDown={() => onDayMouseDown(idx - startDay)}
                onDayMouseEnter={() => onDayMouseEnter(idx - startDay)}
                onDayMouseUp={onDayMouseUp}
                draggingTask={draggingTask}
              />
            )
            : <div key={`empty-${idx}`}></div>
        )}
      </div>
    </div>
  );
}

function CalendarDay({ day, tasks, selecting, idx, onDayMouseDown, onDayMouseEnter, onDayMouseUp, draggingTask }) {
  // For drag-create highlight
  let selected = false;
  if (selecting.on && selecting.startIdx != null && selecting.endIdx != null) {
    const [start, end] = [selecting.startIdx, selecting.endIdx].sort((a, b) => a - b);
    selected = idx >= start && idx <= end;
  }

  // Droppable for DnD task move
  const { setNodeRef } = useDroppable({ id: day.format("YYYY-MM-DD") });

  return (
    <div
      ref={setNodeRef}
      style={{
        position: "relative",
        borderRadius: 6,
        border: selected ? "2px solid #4f46e5" : isToday(day) ? "2px solid #f87171" : "1px solid #e4e4e7",
        background: selected ? "#6366f120" : "#fafbfc",
        padding: 5,
        transition: "border 0.1s, background 0.1s",
        minHeight: 44,
        cursor: "pointer"
      }}
      onMouseDown={onDayMouseDown}
      onMouseEnter={onDayMouseEnter}
      onMouseUp={onDayMouseUp}
    >
      <div style={{
        position: "absolute", top: 4, right: 8, fontSize: 13,
        color: isToday(day) ? "#dc2626" : "#888"
      }}>{day.date()}</div>
      <div style={{ marginTop: 22 }}>
        {/* Render tasks which start on this day as bars */}
        {tasks.map(task =>
          day.format("YYYY-MM-DD") === task.start &&
            <TaskBar key={task.id} day={day} task={task} />
        )}
      </div>
    </div>
  );
}

/////////////// Task Bar ///////////////
function TaskBar({ task }) {
  const { setModal, handleDelete, handleStretch, CATEGORIES } = useTasks();

  // DnD Kit draggable for moving on month
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id, data: { type: "task" }
  });
  // Bar style
  const color = CATEGORIES.find(c => c.value === task.category)?.color || "#e5e7eb";
  // Bar spans N days
  const span = dayjs(task.end).diff(dayjs(task.start), "day");
  const widthPct = (span + 1) * 100 + "%";
  // Stretch handlers
  const stretching = useRef();
  function onStretch(dir, e) {
    e.stopPropagation();
    stretching.current = dir;
    document.addEventListener("mousemove", onResize);
    document.addEventListener("mouseup", onResizeEnd);
    function onResize(ev) {
      const rect = e.target.parentNode.parentNode.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const width = rect.width;
      const dayCount = Math.round(x / (width / (span + 1)));
      if (dir === "right") {
        const newEnd = dayjs(task.start).add(dayCount, "day");
        if (!newEnd.isBefore(dayjs(task.start))) handleStretch(task.id, "right", newEnd.format("YYYY-MM-DD"));
      } else {
        const newStart = dayjs(task.start).add(dayCount, "day");
        if (!newStart.isAfter(dayjs(task.end))) handleStretch(task.id, "left", newStart.format("YYYY-MM-DD"));
      }
    }
    function onResizeEnd() {
      stretching.current = false;
      document.removeEventListener("mousemove", onResize);
      document.removeEventListener("mouseup", onResizeEnd);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        display: "flex", alignItems: "center",
        background: color,
        color: "#222",
        position: "absolute", left: 0, top: 0, height: 30,
        width: `calc(${widthPct} - 16px)`,
        borderRadius: 6, boxShadow: isDragging ? "0 2px 10px #0002" : "0 1px 4px #0001",
        opacity: isDragging ? 0.7 : 1, transition: "box-shadow 0.15s",
        zIndex: 2, cursor: "grab"
      }}
      {...listeners} {...attributes}
      onDoubleClick={() => setModal({ open: true, range: null, editId: task.id })}
      title={task.name}
    >
      {/* Stretch handles */}
      <div
        onMouseDown={e => onStretch("left", e)}
        style={{
          width: 10, height: 26, borderRadius: 5,
          background: "#fff8", cursor: "ew-resize", marginRight: 2
        }}
      ></div>
      <Tooltip
        title={(
          <div>
            <b>{task.name}</b> <br />
            {dayjs(task.start).format("DD MMM")} - {dayjs(task.end).format("DD MMM")} <br />
            <i style={{ color }}>{CATEGORIES.find(c => c.value === task.category)?.label}</i>
          </div>
        )}
        placement="top"
      >
        <div style={{ flexGrow: 1, paddingLeft: 8, fontWeight: 500, fontSize: 16 }}>
          {task.name}
        </div>
      </Tooltip>
      {/* Edit/Delete */}
      <Button
        type="text"
        size="small"
        style={{ color: "#52525b" }}
        onClick={e => { e.stopPropagation(); setModal({ open: true, range: null, editId: task.id }); }}
      >Edit</Button>
      <Button
        type="text"
        size="small"
        danger
        onClick={e => { e.stopPropagation(); handleDelete(task.id); }}
      >Delete</Button>
      <div
        onMouseDown={e => onStretch("right", e)}
        style={{
          width: 10, height: 26, borderRadius: 5,
          background: "#fff8", cursor: "ew-resize", marginLeft: 2
        }}
      ></div>
    </div>
  );
}

//////////////// Filter Panel //////////////
function FilterPanel() {
  const {
    setCatFilters, catFilters, setDurationFilter, durationFilter, setSearch, search, CATEGORIES, FILTERS
  } = useTasks();

  return (
    <div
      style={{
        maxWidth: 1100, margin: "0 auto 16px", display: "flex",
        alignItems: "center", gap: 20, paddingLeft: 8
      }}>
      <Input.Search
        placeholder="Search tasks"
        allowClear
        onChange={e => setSearch(e.target.value)}
        value={search}
        style={{ width: 300, marginRight: 8 }}
      />
      <Checkbox.Group
        options={CATEGORIES.map(c => ({ label: c.label, value: c.value }))}
        value={catFilters}
        onChange={setCatFilters}
        style={{ marginRight: 8 }}
      />
      <Select
        allowClear
        placeholder="Duration"
        options={FILTERS.map(f => ({ label: f.label, value: f.value }))}
        value={durationFilter}
        onChange={setDurationFilter}
        style={{ width: 120 }}
      />
    </div>
  );
}

//////////////// Modal ///////////////////
function TaskModal({ visible, onOk, onCancel, days, modal, tasks }) {
  const { CATEGORIES } = useTasks();
  const editing = modal.editId ? tasks.find(t => t.id === modal.editId) : null;
  const [name, setName] = useState(editing?.name || "");
  const [cat, setCat] = useState(editing?.category || "todo");

  useEffect(() => {
    setName(editing?.name || "");
    setCat(editing?.category || "todo");
  }, [visible, editing]);

  return (
    <Modal
      title={editing ? "Edit Task" : "Create Task"}
      open={visible}
      onOk={() => { if (name.trim()) onOk(name, cat); }}
      onCancel={onCancel}
      okText={editing ? "Update" : "Create"}
    >
      <Input
        placeholder="Task name"
        value={name}
        onChange={e => setName(e.target.value)}
        autoFocus
        maxLength={34}
        style={{ marginBottom: 10 }}
      />
      <Select
        options={CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
        value={cat}
        onChange={setCat}
        style={{ width: "100%" }}
      />
    </Modal>
  );
}
