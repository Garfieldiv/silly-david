import React, { useState, useEffect } from "react";
import {
  QrCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ClipboardCheck,
  Home,
  History,
  MapPin,
  Flame,
  ArrowLeft,
  Camera,
  Info,
  Database,
  Upload,
  FileText,
  Loader2,
} from "lucide-react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  getDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA-lkMLfNnIwe2Pq0UeYD-mz9fmeBxBYU0",
  authDomain: "game-c301d.firebaseapp.com",
  databaseURL:
    "https://game-c301d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "game-c301d",
  storageBucket: "game-c301d.firebasestorage.app",
  messagingSenderId: "315781248145",
  appId: "1:315781248145:web:f55815aa8930469e933b30",
  measurementId: "G-VYYR1QPXKL",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// แก้ไขบรรทัดนี้ เพื่อไม่ให้ TypeScript ใน CodeSandbox แจ้ง Error
const currentAppId =
  typeof window !== "undefined" && window["__app_id"]
    ? window["__app_id"]
    : "fire-extinguisher-app";

export default function App() {
  const [currentView, setCurrentView] = useState("dashboard");
  const [scannedData, setScannedData] = useState(null);

  // Auth State
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // States for duplicate check
  const [showDuplicatePopup, setShowDuplicatePopup] = useState(false);
  const [existingRecord, setExistingRecord] = useState(null);
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  // Inject Tailwind CSS dynamically to ensure styling works anywhere
  useEffect(() => {
    if (!document.getElementById("tailwind-cdn")) {
      const script = document.createElement("script");
      script.id = "tailwind-cdn";
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }
  }, []);

  // การจัดการ Authentication แบบเสถียร (ป้องกันข้อมูลหายตอนรีเฟรช)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsAuthReady(true);
      } else {
        // หากไม่มี User ให้ทำการ Login แบบ Anonymous ใหม่
        signInAnonymously(auth).catch((error) => {
          console.error("Firebase Auth Error:", error);
          // Fallback กรณี Firebase มีปัญหาเรื่อง Authorized Domain
          setUser({ uid: "local-fallback-user" });
          setIsAuthReady(true);
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const handleScanSuccess = async (scannedId) => {
    if (!user) return;
    setIsChecking(true);
    try {
      const extDocRef = doc(
        db,
        "artifacts",
        currentAppId,
        "public",
        "data",
        "extinguishers",
        scannedId
      );
      const extSnap = await getDoc(extDocRef);
      let extinguisherData;

      if (extSnap.exists()) {
        extinguisherData = { id: extSnap.id, ...extSnap.data() };
      } else {
        alert(
          `ไม่พบข้อมูลถังดับเพลิงรหัส: ${scannedId} ในฐานข้อมูล กรุณาเพิ่มข้อมูลผ่านเมนูจัดการฐานข้อมูลก่อน`
        );
        setIsChecking(false);
        return;
      }

      const inspectionsRef = collection(
        db,
        "artifacts",
        currentAppId,
        "public",
        "data",
        "inspections"
      );
      const snapshot = await getDocs(inspectionsRef);
      const allData = snapshot.docs.map((d) => ({ docId: d.id, ...d.data() }));

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      allData.sort((a, b) => b.timestamp - a.timestamp);

      const existing = allData.find((item) => {
        if (item.extinguisherId !== extinguisherData.id) return false;
        const itemDate = new Date(item.timestamp);
        return (
          itemDate.getMonth() === currentMonth &&
          itemDate.getFullYear() === currentYear
        );
      });

      setScannedData(extinguisherData);

      if (existing) {
        setExistingRecord(existing);
        setShowDuplicatePopup(true);
      } else {
        setEditingRecordId(null);
        setCurrentView("inspection");
      }
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการตรวจสอบข้อมูล กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsChecking(false);
    }
  };

  const handleEditExisting = () => {
    setEditingRecordId(existingRecord.docId);
    setShowDuplicatePopup(false);
    setCurrentView("inspection");
  };

  // หน้าจอ Loading ระหว่างรอเชื่อมต่อ Firebase
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center text-red-600">
          <Loader2 size={48} className="animate-spin mb-4" />
          <p className="font-bold">กำลังเชื่อมต่อระบบฐานข้อมูล...</p>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
        return (
          <DashboardView
            user={user}
            onScan={() => setCurrentView("scanner")}
            onViewHistory={() => setCurrentView("history")}
            onManageDb={() => setCurrentView("database")}
          />
        );
      case "scanner":
        return (
          <ScannerView
            onCancel={() => setCurrentView("dashboard")}
            onScanSuccess={(id) => handleScanSuccess(id)}
            isChecking={isChecking}
          />
        );
      case "inspection":
        return (
          <InspectionView
            user={user}
            data={scannedData}
            editingRecordId={editingRecordId}
            existingRecord={existingRecord}
            onCancel={() => setCurrentView("dashboard")}
            onSubmit={() => setCurrentView("success")}
          />
        );
      case "success":
        return (
          <SuccessView
            data={scannedData}
            onHome={() => setCurrentView("dashboard")}
          />
        );
      case "history":
        return (
          <HistoryView user={user} onBack={() => setCurrentView("dashboard")} />
        );
      case "database":
        return (
          <DatabaseView
            user={user}
            onBack={() => setCurrentView("dashboard")}
          />
        );
      default:
        return (
          <DashboardView
            user={user}
            onScan={() => setCurrentView("scanner")}
            onViewHistory={() => setCurrentView("history")}
            onManageDb={() => setCurrentView("database")}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center font-sans">
      <div className="w-full max-w-md bg-white shadow-2xl relative min-h-screen flex flex-col overflow-hidden">
        {renderView()}

        {/* Duplicate Popup */}
        {showDuplicatePopup && existingRecord && (
          <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mb-4 mx-auto shadow-inner">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-center text-gray-800 mb-2">
                ตรวจเช็คไปแล้วเดือนนี้!
              </h3>
              <p className="text-center text-gray-600 text-sm mb-6 leading-relaxed">
                ถังรหัส{" "}
                <span className="font-bold text-red-600">
                  {existingRecord.extinguisherId}
                </span>
                <br />
                ถูกตรวจไปแล้วเมื่อวันที่
                <br />
                <span className="font-bold text-gray-900 mt-2 block text-lg">
                  {new Date(existingRecord.timestamp).toLocaleDateString(
                    "th-TH",
                    { year: "numeric", month: "long", day: "numeric" }
                  )}
                </span>
                <span className="font-bold text-gray-900 block text-base">
                  เวลา{" "}
                  {new Date(existingRecord.timestamp).toLocaleTimeString(
                    "th-TH",
                    { hour: "2-digit", minute: "2-digit" }
                  )}{" "}
                  น.
                </span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDuplicatePopup(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleEditExisting}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-yellow-500 hover:bg-yellow-600 transition-colors shadow-lg shadow-yellow-500/30"
                >
                  แก้ไขผลตรวจ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes scan-line {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan-line {
          animation: scan-line 2s linear infinite;
        }
      `,
        }}
      />
    </div>
  );
}

// --- Views ---

function DashboardView({ user, onScan, onViewHistory, onManageDb }) {
  const [recentActivities, setRecentActivities] = useState([]);
  const [stats, setStats] = useState({ total: 0, inspected: 0, broken: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const db = getFirestore();

    const extRef = collection(
      db,
      "artifacts",
      currentAppId,
      "public",
      "data",
      "extinguishers"
    );
    const unsubscribeExt = onSnapshot(extRef, (snapshot) => {
      setStats((prev) => ({ ...prev, total: snapshot.size }));
    });

    const inspectionsRef = collection(
      db,
      "artifacts",
      currentAppId,
      "public",
      "data",
      "inspections"
    );
    const unsubscribeInsp = onSnapshot(
      inspectionsRef,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        data.sort((a, b) => b.timestamp - a.timestamp);

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const inspectedThisMonth = new Set();
        const latestStatusMap = {};

        data.forEach((item) => {
          const itemDate = new Date(item.timestamp);
          if (
            itemDate.getMonth() === currentMonth &&
            itemDate.getFullYear() === currentYear
          ) {
            inspectedThisMonth.add(item.extinguisherId);
          }

          if (
            !latestStatusMap[item.extinguisherId] ||
            item.timestamp > latestStatusMap[item.extinguisherId].timestamp
          ) {
            latestStatusMap[item.extinguisherId] = item;
          }
        });

        let actualBrokenCount = 0;
        Object.values(latestStatusMap).forEach((item) => {
          if (item.status === "fail") actualBrokenCount++;
        });

        setStats((prev) => ({
          ...prev,
          inspected: inspectedThisMonth.size,
          broken: actualBrokenCount,
        }));

        setRecentActivities(data.slice(0, 10));
        setIsLoading(false);
      },
      (error) => {
        console.error("Snapshot error:", error);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribeExt();
      unsubscribeInsp();
    };
  }, [user]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-red-600 text-white pt-12 pb-6 px-6 rounded-b-3xl shadow-md">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold">ระบบตรวจถังดับเพลิง</h1>
            <p className="text-red-100 text-sm mt-1">
              บริษัท ตัวอย่าง จำกัด (มหาชน)
            </p>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <Flame size={28} className="text-white" />
          </div>
        </div>
      </div>

      <div className="px-6 -mt-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex justify-between items-center">
          <div className="text-center w-1/3">
            <p className="text-gray-500 text-xs font-medium mb-1">ทั้งหมด</p>
            <p className="text-2xl font-bold text-gray-800">
              {isLoading ? (
                <Loader2
                  size={24}
                  className="animate-spin mx-auto text-gray-400"
                />
              ) : (
                stats.total
              )}
            </p>
          </div>
          <div className="w-px h-10 bg-gray-200"></div>
          <div className="text-center w-1/3">
            <p className="text-gray-500 text-xs font-medium mb-1">ตรวจแล้ว</p>
            <p className="text-2xl font-bold text-green-600">
              {isLoading ? (
                <Loader2
                  size={24}
                  className="animate-spin mx-auto text-green-400"
                />
              ) : (
                stats.inspected
              )}
            </p>
          </div>
          <div className="w-px h-10 bg-gray-200"></div>
          <div className="text-center w-1/3">
            <p className="text-gray-500 text-xs font-medium mb-1">
              ชำรุด/แจ้งซ่อม
            </p>
            <p className="text-2xl font-bold text-red-500">
              {isLoading ? (
                <Loader2
                  size={24}
                  className="animate-spin mx-auto text-red-400"
                />
              ) : (
                stats.broken
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 mb-8">
        <button
          onClick={onScan}
          className="w-full bg-red-600 hover:bg-red-700 active:scale-95 transition-all text-white rounded-2xl p-4 flex flex-col items-center justify-center shadow-lg shadow-red-600/30 group"
        >
          <div className="bg-white/20 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform">
            <QrCode size={40} />
          </div>
          <span className="text-xl font-bold">สแกน QR Code</span>
          <span className="text-red-100 text-sm mt-1">
            เพื่อเริ่มการตรวจเช็ค
          </span>
        </button>
      </div>

      <div className="px-6 flex-1">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-lg font-bold text-gray-800">รายการล่าสุด</h2>
          <button
            onClick={onViewHistory}
            className="text-sm text-red-600 font-medium hover:underline"
          >
            ดูทั้งหมด
          </button>
        </div>

        <div className="space-y-3 pb-24">
          {isLoading ? (
            <div className="text-center p-6 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl flex flex-col items-center">
              <Loader2 size={24} className="animate-spin mb-2" /> กำลังโหลด...
            </div>
          ) : recentActivities.length > 0 ? (
            recentActivities.map((item, idx) => (
              <div
                key={idx}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-50 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full ${
                      item.status === "pass"
                        ? "bg-green-100 text-green-600"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {item.status === "pass" ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <AlertTriangle size={20} />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">
                      {item.extinguisherId}
                    </p>
                    <p className="text-gray-500 text-xs truncate max-w-[150px]">
                      {item.buildingFloor || item.location}
                    </p>
                    {item.installPoint && (
                      <p className="text-xs text-green-600 mt-0.5 truncate max-w-[150px] flex items-center gap-1">
                        <MapPin size={10} /> {item.installPoint}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-gray-400 text-xs shrink-0">
                  {new Date(item.timestamp).toLocaleTimeString("th-TH", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  น.
                </span>
              </div>
            ))
          ) : (
            <div className="text-center p-6 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
              ยังไม่มีประวัติการตรวจสอบ
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 flex justify-around p-4 pb-6 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] text-gray-400">
        <button className="flex flex-col items-center gap-1 text-red-600">
          <Home size={24} />
          <span className="text-[10px] font-medium">หน้าหลัก</span>
        </button>
        <button
          onClick={onViewHistory}
          className="flex flex-col items-center gap-1 hover:text-red-600 transition-colors"
        >
          <History size={24} />
          <span className="text-[10px] font-medium">ประวัติ</span>
        </button>
        <button
          onClick={onManageDb}
          className="flex flex-col items-center gap-1 hover:text-red-600 transition-colors"
        >
          <Database size={24} />
          <span className="text-[10px] font-medium">ฐานข้อมูล</span>
        </button>
      </div>
    </div>
  );
}

function ScannerView({ onCancel, onScanSuccess, isChecking }) {
  const [mockId, setMockId] = useState("");

  return (
    <div className="flex flex-col h-full bg-black relative">
      <div className="absolute top-0 w-full p-6 pt-12 flex justify-between items-center z-10 text-white">
        <button
          onClick={onCancel}
          className="bg-black/40 p-2 rounded-full backdrop-blur-sm"
        >
          <ArrowLeft size={24} />
        </button>
        <h2 className="font-medium text-lg tracking-wide">สแกน QR Code</h2>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gray-800 bg-[url('https://images.unsplash.com/photo-1582131503261-f28d821f576e?q=80&w=600&auto=format&fit=crop')] bg-cover bg-center opacity-40 blur-sm"></div>

        <div className="relative w-64 h-64 z-10">
          <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-red-500 rounded-tl-xl"></div>
          <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-red-500 rounded-tr-xl"></div>
          <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-red-500 rounded-bl-xl"></div>
          <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-red-500 rounded-br-xl"></div>
          <div className="absolute w-full h-0.5 bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.6)] animate-scan-line"></div>
        </div>

        <div className="absolute bottom-16 text-center z-10 w-full px-8">
          <p className="text-white text-sm mb-4 bg-black/50 inline-block px-4 py-2 rounded-full backdrop-blur-sm">
            จัดให้ QR Code อยู่ในกรอบเพื่อสแกน
          </p>

          <div className="bg-white/10 p-4 rounded-xl backdrop-blur-md mb-4 border border-white/20">
            <label className="text-xs text-gray-300 block mb-1 text-left">
              ระบุรหัสถังดับเพลิงเพื่อตรวจ
            </label>
            <input
              type="text"
              value={mockId}
              onChange={(e) => setMockId(e.target.value)}
              className="w-full bg-white/20 text-white placeholder-gray-400 border border-white/30 rounded-lg px-3 py-2 outline-none focus:border-red-500"
              placeholder="เช่น FE-001"
            />
          </div>

          <button
            onClick={() => onScanSuccess(mockId)}
            disabled={isChecking || !mockId}
            className={`w-full font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 ${
              isChecking || !mockId
                ? "bg-gray-300 text-gray-600"
                : "bg-white text-black"
            }`}
          >
            {isChecking ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Camera size={20} />
            )}
            {isChecking ? "กำลังตรวจสอบข้อมูล..." : "ตกลง"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InspectionView({
  user,
  data,
  onCancel,
  onSubmit,
  editingRecordId,
  existingRecord,
}) {
  const [checks, setChecks] = useState(
    editingRecordId && existingRecord?.checks
      ? existingRecord.checks
      : {
          pressure: null,
          pin: null,
          hose: null,
          body: null,
        }
  );
  const [status, setStatus] = useState(
    editingRecordId && existingRecord?.status ? existingRecord.status : "pass"
  );
  const [notes, setNotes] = useState(
    editingRecordId && existingRecord?.notes ? existingRecord.notes : ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCheck = (key, val) => {
    setChecks((prev) => ({ ...prev, [key]: val }));
  };

  const isFormComplete = Object.values(checks).every((val) => val !== null);

  const CheckItem = ({ id, label, icon: Icon }) => (
    <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm mb-3">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-50 rounded-lg text-gray-500">
          <Icon size={20} />
        </div>
        <span className="font-medium text-gray-700">{label}</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => handleCheck(id, true)}
          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
            checks[id] === true
              ? "bg-green-500 border-green-500 text-white shadow-md shadow-green-200"
              : "border-gray-200 text-gray-300 hover:border-green-200"
          }`}
        >
          <CheckCircle2 size={24} />
        </button>
        <button
          onClick={() => handleCheck(id, false)}
          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
            checks[id] === false
              ? "bg-red-500 border-red-500 text-white shadow-md shadow-red-200"
              : "border-gray-200 text-gray-300 hover:border-red-200"
          }`}
        >
          <XCircle size={24} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-y-auto">
      <div className="bg-white px-6 pt-12 pb-4 border-b border-gray-100 flex items-center sticky top-0 z-20">
        <button
          onClick={onCancel}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600"
        >
          <ArrowLeft size={24} />
        </button>
        <h2 className="font-bold text-xl ml-2 text-gray-800">
          บันทึกการตรวจสอบ
        </h2>
      </div>

      <div className="p-6 pb-32">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">
                รหัสอุปกรณ์
              </p>
              <h3 className="text-xl font-black text-gray-900">{data?.id}</h3>
            </div>
            <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
              <Info size={14} /> ข้อมูล
            </div>
          </div>

          <div className="space-y-2 mt-4 pt-4 border-t border-gray-50 text-sm">
            <div className="flex gap-2 text-gray-600">
              <MapPin size={18} className="text-gray-400 shrink-0" />
              <div className="flex flex-col">
                <span className="font-medium text-gray-800">
                  {data?.buildingFloor || data?.location}
                </span>
                {data?.installPoint && (
                  <span className="text-xs text-gray-500 mt-0.5">
                    <span className="font-semibold text-green-600">
                      จุดติดตั้ง:
                    </span>{" "}
                    {data.installPoint}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 text-gray-600">
              <Flame size={18} className="text-gray-400 shrink-0" />
              <span>
                {data?.type} - {data?.size}
              </span>
            </div>
          </div>
        </div>

        <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <ClipboardCheck size={20} className="text-red-500" />
          รายการตรวจสอบ (Checklist)
        </h4>

        <CheckItem
          id="pressure"
          label="เกจ์วัดแรงดัน (Pressure)"
          icon={CheckCircle2}
        />
        <CheckItem id="pin" label="สลักและซีล (Pin & Seal)" icon={Info} />
        <CheckItem
          id="hose"
          label="สายฉีด (Hose & Nozzle)"
          icon={AlertTriangle}
        />
        <CheckItem id="body" label="สภาพตัวถัง (Cylinder)" icon={Flame} />

        <div className="mt-8 mb-4">
          <h4 className="font-bold text-gray-800 mb-3">สรุปผลการตรวจสอบ</h4>
          <div className="flex gap-3 bg-white p-2 rounded-xl border border-gray-100">
            <button
              onClick={() => setStatus("pass")}
              className={`flex-1 py-3 rounded-lg font-bold text-sm transition-colors ${
                status === "pass"
                  ? "bg-green-100 text-green-700 border border-green-200"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              ปกติ / พร้อมใช้งาน
            </button>
            <button
              onClick={() => setStatus("fail")}
              className={`flex-1 py-3 rounded-lg font-bold text-sm transition-colors ${
                status === "fail"
                  ? "bg-red-100 text-red-700 border border-red-200"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              ชำรุด / แจ้งซ่อม
            </button>
          </div>
        </div>

        <div className="mb-6">
          <textarea
            placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSubmitting}
            className="w-full bg-white border border-gray-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 min-h-[100px]"
          ></textarea>
        </div>
      </div>

      <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 p-4 pb-6 shadow-[0_-10px_20px_rgba(0,0,0,0.03)] z-20">
        <button
          onClick={async () => {
            if (!user) return;
            setIsSubmitting(true);
            try {
              if (editingRecordId) {
                const docRef = doc(
                  db,
                  "artifacts",
                  currentAppId,
                  "public",
                  "data",
                  "inspections",
                  editingRecordId
                );
                await updateDoc(docRef, {
                  checks,
                  status,
                  notes,
                  timestamp: Date.now(),
                  userId: user.uid,
                  buildingFloor: data.buildingFloor || "",
                  installPoint: data.installPoint || "",
                });
              } else {
                const inspectionsRef = collection(
                  db,
                  "artifacts",
                  currentAppId,
                  "public",
                  "data",
                  "inspections"
                );
                await addDoc(inspectionsRef, {
                  extinguisherId: data.id,
                  location: data.location,
                  buildingFloor: data.buildingFloor || "",
                  installPoint: data.installPoint || "",
                  type: data.type,
                  checks,
                  status,
                  notes,
                  timestamp: Date.now(),
                  userId: user.uid,
                });
              }
              onSubmit();
            } catch (err) {
              console.error("Error saving document: ", err);
            } finally {
              setIsSubmitting(false);
            }
          }}
          disabled={!isFormComplete || isSubmitting}
          className={`w-full py-4 rounded-xl font-bold text-lg flex justify-center items-center gap-2 transition-all ${
            isFormComplete && !isSubmitting
              ? "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : null}
          {isSubmitting
            ? "กำลังบันทึก..."
            : editingRecordId
            ? "บันทึกแก้ไขผลตรวจ"
            : "บันทึกผลการตรวจสอบ"}
        </button>
      </div>
    </div>
  );
}

function SuccessView({ data, onHome }) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-red-600 text-white p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-red-500 rounded-full blur-3xl opacity-50"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-orange-500 rounded-full blur-3xl opacity-50"></div>

      <div className="z-10 flex flex-col items-center text-center animate-in zoom-in duration-500">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-red-900/50">
          <CheckCircle2 size={56} className="text-red-600" />
        </div>

        <h2 className="text-3xl font-black mb-2">บันทึกสำเร็จ!</h2>
        <p className="text-red-100 mb-10 text-lg">
          ระบบได้บันทึกข้อมูลการตรวจเช็คเรียบร้อยแล้ว
        </p>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 w-full max-w-xs border border-white/20 mb-12">
          <div className="flex justify-between items-center mb-3">
            <span className="text-red-100 text-sm">รหัสถัง</span>
            <span className="font-bold">{data?.id || "-"}</span>
          </div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-red-100 text-sm">วันที่ตรวจ</span>
            <span className="font-bold">
              {new Date().toLocaleDateString("th-TH", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-red-100 text-sm">สถานะ</span>
            <span className="bg-green-500/20 text-green-100 px-2 py-1 rounded text-sm font-bold border border-green-400/30">
              บันทึกเรียบร้อย
            </span>
          </div>
        </div>

        <button
          onClick={onHome}
          className="w-full max-w-xs bg-white text-red-600 font-bold py-4 rounded-xl shadow-xl hover:bg-gray-50 active:scale-95 transition-all"
        >
          กลับสู่หน้าหลัก
        </button>
      </div>
    </div>
  );
}

function HistoryView({ user, onBack }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const db = getFirestore();
    const inspectionsRef = collection(
      db,
      "artifacts",
      currentAppId,
      "public",
      "data",
      "inspections"
    );

    const unsubscribe = onSnapshot(
      inspectionsRef,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        data.sort((a, b) => b.timestamp - a.timestamp);
        setHistory(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching history:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white px-6 pt-12 pb-4 border-b border-gray-100 flex items-center sticky top-0 z-20 shadow-sm">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h2 className="font-bold text-xl ml-2 text-gray-800">
          ประวัติการตรวจสอบทั้งหมด
        </h2>
      </div>

      <div className="p-4 overflow-y-auto pb-24 flex-1">
        {loading ? (
          <div className="text-center text-gray-500 py-10 flex flex-col items-center">
            <Loader2 size={32} className="animate-spin mb-4 text-red-400" />
            กำลังโหลดข้อมูล...
          </div>
        ) : history.length > 0 ? (
          <div className="space-y-3">
            {history.map((item, idx) => (
              <div
                key={idx}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-full ${
                        item.status === "pass"
                          ? "bg-green-100 text-green-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {item.status === "pass" ? (
                        <CheckCircle2 size={20} />
                      ) : (
                        <AlertTriangle size={20} />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">
                        {item.extinguisherId}
                      </h3>
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">
                        {item.buildingFloor || item.location}
                      </p>
                      {item.installPoint && (
                        <p className="text-xs text-green-600 mt-1 truncate max-w-[200px] flex items-center gap-1 font-medium">
                          <MapPin size={12} /> จุดติดตั้ง: {item.installPoint}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between items-center">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <History size={12} />
                    {new Date(item.timestamp).toLocaleDateString("th-TH", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                    {" • "}
                    {new Date(item.timestamp).toLocaleTimeString("th-TH", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    น.
                  </span>
                  {item.notes && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md max-w-[120px] truncate">
                      {item.notes}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 px-6 flex flex-col items-center bg-white rounded-2xl border border-dashed border-gray-200">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-4">
              <ClipboardCheck size={32} />
            </div>
            <p className="text-gray-600 font-medium mb-1">
              ยังไม่มีประวัติการตรวจสอบ
            </p>
            <p className="text-sm text-gray-400">
              เมื่อคุณบันทึกการตรวจสอบ ประวัติทั้งหมดจะถูกรวบรวมไว้ที่นี่
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DatabaseView({ user, onBack }) {
  const [dbItems, setDbItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const db = getFirestore();
    const extRef = collection(
      db,
      "artifacts",
      currentAppId,
      "public",
      "data",
      "extinguishers"
    );

    const unsubscribe = onSnapshot(
      extRef,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setDbItems(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching database:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result.replace(/^\uFEFF/, "");
        const lines = text.split("\n");
        const headers = lines[0]
          .split(",")
          .map((h) => h.trim().replace(/\r/g, ""));

        const db = getFirestore();

        let count = 0;
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const currentline = lines[i].split(",");
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = currentline[index]?.trim().replace(/\r/g, "");
          });

          const docId = obj["หมายเลขถังดับเพลิง"];
          if (docId) {
            const extData = {
              id: docId,
              no: obj["No."] || "",
              type:
                obj["ประเภทถังดับเพลิง"] || obj["ประเภท"] || "ไม่ระบุประเภท",
              buildingFloor: obj["อาคาร / ชั้น"] || "",
              assetCode: obj["Asset Code"] || "",
              size: obj["Capacity (lb.)"] ? `${obj["Capacity (lb.)"]} lbs` : "",
              brand: obj["Brand"] || "",
              mfgYear: obj["ปีผลิต"] || "",
              lastRefill: obj["วันที่บรรจุสารล่าสุด"] || "",
              installPoint: obj["จุดติดตั้งถังดับเพลิง"] || "",
              location: `${obj["อาคาร / ชั้น"] || ""} ${
                obj["จุดติดตั้งถังดับเพลิง"]
                  ? "- " + obj["จุดติดตั้งถังดับเพลิง"]
                  : ""
              }`.trim(),
            };

            const extDocRef = doc(
              db,
              "artifacts",
              currentAppId,
              "public",
              "data",
              "extinguishers",
              docId
            );
            await setDoc(extDocRef, extData);
            count++;
          }
        }
        alert(`อัปโหลดสำเร็จ! นำเข้าข้อมูลทั้งหมด ${count} รายการ`);
      } catch (err) {
        console.error(err);
        alert("เกิดข้อผิดพลาดในการอ่านไฟล์ CSV โปรดตรวจสอบรูปแบบไฟล์");
      } finally {
        setUploading(false);
        e.target.value = null; // reset input
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const template =
      "หมายเลขถังดับเพลิง,No.,ประเภทถังดับเพลิง,อาคาร / ชั้น,Asset Code,Capacity (lb.),Brand,ปีผลิต,วันที่บรรจุสารล่าสุด,จุดติดตั้งถังดับเพลิง\nFE-001,1,เคมีแห้ง (Dry Chemical),อาคาร A ชั้น 1,AC-A01,15,Firemaster,2023,01/01/2026,ข้างบันไดหนีไฟ\nFE-002,2,คาร์บอนไดออกไซด์ (CO2),อาคาร B ชั้น 2,AC-B02,10,Saturn,2022,15/02/2026,หน้าห้องประชุม";

    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([bom, template], { type: "text/csv;charset=utf-8;" });

    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "extinguisher_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white px-6 pt-12 pb-4 border-b border-gray-100 flex items-center sticky top-0 z-20 shadow-sm">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h2 className="font-bold text-xl ml-2 text-gray-800">
          จัดการฐานข้อมูลอุปกรณ์
        </h2>
      </div>

      <div className="p-6 flex-1 overflow-y-auto pb-24">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
            <Database size={20} className="text-red-600" />
            นำเข้าข้อมูลด้วยไฟล์ CSV
          </h3>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            ไฟล์ต้องมีหัวตาราง: <br />
            <span className="font-mono bg-gray-100 px-1 rounded text-[10px]">
              หมายเลขถังดับเพลิง
            </span>
            ,
            <span className="font-mono bg-gray-100 px-1 rounded text-[10px]">
              {" "}
              No.
            </span>
            ,
            <span className="font-mono bg-gray-100 px-1 rounded text-[10px]">
              {" "}
              ประเภทถังดับเพลิง
            </span>
            ,
            <span className="font-mono bg-gray-100 px-1 rounded text-[10px]">
              {" "}
              อาคาร / ชั้น
            </span>
            ,
            <span className="font-mono bg-gray-100 px-1 rounded text-[10px]">
              {" "}
              Asset Code
            </span>
            ,
            <span className="font-mono bg-gray-100 px-1 rounded text-[10px]">
              {" "}
              Capacity (lb.)
            </span>
            ,
            <span className="font-mono bg-gray-100 px-1 rounded text-[10px]">
              {" "}
              Brand
            </span>
            ,
            <span className="font-mono bg-gray-100 px-1 rounded text-[10px]">
              {" "}
              ปีผลิต
            </span>
            ,
            <span className="font-mono bg-gray-100 px-1 rounded text-[10px]">
              {" "}
              วันที่บรรจุสารล่าสุด
            </span>
            ,
            <span className="font-mono bg-gray-100 px-1 rounded text-[10px]">
              {" "}
              จุดติดตั้งถังดับเพลิง
            </span>
          </p>

          <div className="flex flex-col gap-3">
            <label
              className={`w-full py-3 rounded-xl font-bold text-sm flex justify-center items-center gap-2 transition-all cursor-pointer ${
                uploading
                  ? "bg-gray-200 text-gray-500"
                  : "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
              }`}
            >
              {uploading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Upload size={18} />
              )}
              {uploading
                ? "กำลังนำเข้าข้อมูล..."
                : "เลือกไฟล์ .CSV เพื่ออัปโหลด"}
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>

            <button
              onClick={handleDownloadTemplate}
              className="w-full py-2 rounded-xl text-xs font-medium flex justify-center items-center gap-1 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all"
            >
              <FileText size={14} />
              ดาวน์โหลดไฟล์ตัวอย่าง (Template)
            </button>
          </div>
        </div>

        <div>
          <h3 className="font-bold text-gray-800 mb-3 flex items-center justify-between">
            รายการถังดับเพลิงในระบบ
            <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs">
              {dbItems.length}
            </span>
          </h3>

          {loading ? (
            <div className="text-center py-8 text-gray-400 text-sm flex flex-col items-center">
              <Loader2 size={24} className="animate-spin mb-2" />{" "}
              กำลังโหลดข้อมูล...
            </div>
          ) : dbItems.length > 0 ? (
            <div className="space-y-3">
              {dbItems.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-white p-4 rounded-xl shadow-sm border border-gray-100"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-gray-800">
                        {item.id || item.ID}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1 font-medium">
                        {item.buildingFloor || item.location}
                      </p>
                    </div>
                    <span className="bg-gray-50 text-gray-600 px-2 py-1 rounded text-[10px] font-medium border border-gray-200">
                      {item.size || "-"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-col gap-1.5">
                    {item.installPoint && (
                      <p className="text-xs text-gray-700 flex items-center gap-1.5">
                        <MapPin size={14} className="text-green-500" />
                        <span className="font-semibold">จุดติดตั้ง:</span>{" "}
                        {item.installPoint}
                      </p>
                    )}
                    <p className="text-xs text-gray-700 flex items-center gap-1.5">
                      <Flame size={14} className="text-red-500" />
                      <span className="font-semibold">ประเภท:</span> {item.type}
                    </p>
                    {item.brand && (
                      <p className="text-xs text-gray-500 flex items-center gap-1.5">
                        <Info size={14} className="text-blue-500" />
                        <span className="font-semibold">ยี่ห้อ:</span>{" "}
                        {item.brand}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-200">
              <p className="text-gray-400 text-sm">ยังไม่มีข้อมูลในฐานข้อมูล</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
