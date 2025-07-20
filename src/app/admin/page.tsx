"use client";

import { useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/Button";
import { blockchainService } from "@/services/blockchain";
import { truncateAddress } from "@/lib/utils";
import { ethers } from "ethers";
import {
  Shield,
  Play,
  Pause,
  Plus,
  Users,
  GraduationCap,
  Settings,
  Trash2,
  CheckCircle,
  XCircle,
  School,
  UserPlus,
  UserMinus,
  FileText,
  Eye,
} from "lucide-react";

interface University {
  address: string;
  name: string;
}

interface Admin {
  address: string;
  addedBy?: string;
}

interface CustomRecordType {
  id: number;
  name: string;
  description: string;
  creator: string;
  timestamp: number;
  isActive: boolean;
}

/**
 * Renders the administrative dashboard for managing a blockchain-based academic record system.
 *
 * Provides role-based access for super admins and admins to manage universities, admins, students, and custom record types. Handles authentication, contract state (pause/unpause), and displays system statistics and entity management forms within a tabbed interface.
 *
 * Redirects unauthorized users to the login page and displays real-time feedback for all blockchain operations.
 *
 * @returns The admin dashboard React component.
 */
export default function AdminPage() {
  const router = useRouter();
  const [connectedAddress, setConnectedAddress] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Super Admin specific states
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [newAdminAddress, setNewAdminAddress] = useState("");

  // University management
  const [universities, setUniversities] = useState<University[]>([]);
  const [newUniversityAddress, setNewUniversityAddress] = useState("");
  const [newUniversityName, setNewUniversityName] = useState("");
  const [editingUniversity, setEditingUniversity] = useState<{
    address: string;
    name: string;
  } | null>(null);

  // Custom Record Types
  const [customTypes, setCustomTypes] = useState<CustomRecordType[]>([]);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeDescription, setNewTypeDescription] = useState("");

  // Stats
  const [stats, setStats] = useState({
    totalRecords: 0,
    totalCustomTypes: 0,
    totalUniversities: 0,
    totalAdmins: 0,
  });

  // Student management
  const [newStudentId, setNewStudentId] = useState("");
  const [newStudentAddress, setNewStudentAddress] = useState("");

  useEffect(() => {
    const initWallet = async () => {
      try {
        const success = await blockchainService.init();
        if (!success) {
          router.push("/login");
          return;
        }

        const address = await blockchainService.getCurrentAddress();
        console.log("Connected Address:", address);
        setConnectedAddress(address);

        const hasAdminRole = await blockchainService.hasRole(
          "ADMIN_ROLE",
          address
        );
        console.log("Admin Role:", hasAdminRole);
        setIsAdmin(hasAdminRole);

        const hasSuperAdminRole = await blockchainService.hasRole(
          "SUPER_ADMIN_ROLE",
          address
        );
        console.log("Super Admin Role:", hasSuperAdminRole);
        setIsSuperAdmin(hasSuperAdminRole);

        if (!hasAdminRole && !hasSuperAdminRole) {
          router.push("/login");
          return;
        }

        if (hasSuperAdminRole && !hasAdminRole) {
          setIsAdmin(true);
        }

        await loadData();
        setLoading(false);
      } catch (err) {
        console.error("Error initializing wallet:", err);
        setError("Failed to initialize wallet. Please try again.");
        setLoading(false);
      }
    };

    initWallet();
  }, [router]);

  const loadData = async () => {
    try {
      // Load basic data
      const paused = await blockchainService.isPaused();
      setIsPaused(paused);

      const allUniversities = await blockchainService.getAllUniversities();
      setUniversities(allUniversities);

      // Load stats
      const totalRecords = await blockchainService.getTotalRecords();
      const totalCustomTypes = await blockchainService.getTotalCustomTypes();

      setStats({
        totalRecords,
        totalCustomTypes,
        totalUniversities: allUniversities.length,
        totalAdmins: 0, // Will be updated if super admin
      });

      // Load super admin specific data
      if (isSuperAdmin) {
        const allAdmins = await blockchainService.getAllAdmins();
        setAdmins(allAdmins.map((addr) => ({ address: addr })));
        setStats((prev) => ({ ...prev, totalAdmins: allAdmins.length }));
      }

      // Load custom types for universities
      if (isAdmin) {
        // TODO: Load university custom types if user is a university
        // This would need to be implemented in blockchain service
      }
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Failed to load data.");
    }
  };

  const showMessage = (message: string, type: "success" | "error") => {
    if (type === "success") {
      setSuccess(message);
      setError("");
    } else {
      setError(message);
      setSuccess("");
    }
    setTimeout(() => {
      setSuccess("");
      setError("");
    }, 5000);
  };

  const handlePauseToggle = async () => {
    try {
      setLoading(true);
      if (isPaused) {
        await blockchainService.unpauseContract();
        showMessage("Contract unpaused successfully", "success");
      } else {
        await blockchainService.pauseContract();
        showMessage("Contract paused successfully", "success");
      }
      setIsPaused(!isPaused);
    } catch (err) {
      console.error("Error toggling pause state:", err);
      showMessage("Failed to update contract state", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUniversity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUniversityAddress) {
      showMessage("Please enter a university blockchain address", "error");
      return;
    }

    try {
      setLoading(true);
      await blockchainService.addUniversity(
        newUniversityAddress,
        newUniversityName || "Unnamed University"
      );
      await loadData();
      setNewUniversityAddress("");
      setNewUniversityName("");
      showMessage("University added successfully", "success");
    } catch (err) {
      console.error("Error adding university:", err);
      showMessage("Failed to add university", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentId || !newStudentAddress) {
      showMessage("Please enter both student ID and wallet address", "error");
      return;
    }

    if (!ethers.isAddress(newStudentAddress)) {
      showMessage("Invalid Ethereum address format", "error");
      return;
    }

    try {
      setLoading(true);
      await blockchainService.registerStudent(newStudentId, newStudentAddress);
      setNewStudentId("");
      setNewStudentAddress("");
      showMessage("Student registered successfully", "success");
    } catch (err) {
      console.error("Error registering student:", err);
      showMessage("Failed to register student", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminAddress) {
      showMessage("Please enter an admin address", "error");
      return;
    }

    try {
      setLoading(true);
      await blockchainService.addAdmin(newAdminAddress);
      await loadData();
      setNewAdminAddress("");
      showMessage("Admin added successfully", "success");
    } catch (err) {
      console.error("Error adding admin:", err);
      showMessage("Failed to add admin", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAdmin = async (adminAddress: string) => {
    if (!confirm("Are you sure you want to remove this admin?")) return;

    try {
      setLoading(true);
      await blockchainService.removeAdmin(adminAddress);
      await loadData();
      showMessage("Admin removed successfully", "success");
    } catch (err) {
      console.error("Error removing admin:", err);
      showMessage("Failed to remove admin", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUniversity = async (universityAddress: string) => {
    if (!confirm("Are you sure you want to remove this university?")) return;

    try {
      setLoading(true);
      await blockchainService.removeUniversity(universityAddress);
      await loadData();
      showMessage("University removed successfully", "success");
    } catch (err) {
      console.error("Error removing university:", err);
      showMessage("Failed to remove university", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName || !newTypeDescription) {
      showMessage("Please fill in all fields", "error");
      return;
    }

    try {
      setLoading(true);
      await blockchainService.addCustomRecordType(
        newTypeName,
        newTypeDescription
      );
      await loadData();
      setNewTypeName("");
      setNewTypeDescription("");
      showMessage("Custom record type added successfully", "success");
    } catch (err) {
      console.error("Error adding custom type:", err);
      showMessage("Failed to add custom record type", "error");
    } finally {
      setLoading(false);
    }
  };

  // handleRegisterStudent is already defined above

  const StatCard = ({
    icon: Icon,
    title,
    value,
    color,
  }: {
    icon: any;
    title: string;
    value: number;
    color: string;
  }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  const TabButton = ({
    id,
    label,
    icon: Icon,
  }: {
    id: string;
    label: ReactNode;
    icon: any;
  }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        activeTab === id
          ? "bg-blue-600 text-white"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
      }`}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </button>
  );

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center">
                <Shield className="w-8 h-8 text-blue-600 mr-3" />
                {isSuperAdmin ? "Super Admin Panel" : "Admin Panel"}
              </h1>
              <p className="text-gray-600 mt-1">
                Connected as:{" "}
                <span className="font-medium">
                  {truncateAddress(connectedAddress)}
                </span>
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div
                className={`flex items-center space-x-2 px-4 py-2 rounded-full ${
                  isPaused
                    ? "bg-red-100 text-red-800"
                    : "bg-green-100 text-green-800"
                }`}
              >
                {isPaused ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                <span className="font-medium">
                  {isPaused ? "Paused" : "Active"}
                </span>
              </div>
              {isSuperAdmin && (
                <Button
                  onClick={handlePauseToggle}
                  className={`${
                    isPaused
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {isPaused ? (
                    <Play className="w-4 h-4 mr-2" />
                  ) : (
                    <Pause className="w-4 h-4 mr-2" />
                  )}
                  {isPaused ? "Unpause Contract" : "Pause Contract"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
            <XCircle className="w-5 h-5 text-red-500 mr-3" />
            <span className="text-red-700">{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
            <span className="text-green-700">{success}</span>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={FileText}
            title="Total Records"
            value={stats.totalRecords}
            color="bg-blue-500"
          />
          <StatCard
            icon={School}
            title="Universities"
            value={stats.totalUniversities}
            color="bg-green-500"
          />
          <StatCard
            icon={Settings}
            title="Custom Types"
            value={stats.totalCustomTypes}
            color="bg-purple-500"
          />
          {isSuperAdmin && (
            <StatCard
              icon={Users}
              title="Admins"
              value={stats.totalAdmins}
              color="bg-orange-500"
            />
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-2 mb-8 border-b border-gray-200 pb-4">
          <TabButton
            id="overview"
            label={<span className="text-white">Overview</span>}
            icon={Eye}
          />
          <TabButton
            id="universities"
            label={<span className="text-white">Universities</span>}
            icon={GraduationCap}
          />
          {isSuperAdmin && (
            <TabButton
              id="admins"
              label={<span className="text-white">Admin Management</span>}
              icon={Users}
            />
          )}
          <TabButton
            id="students"
            label={<span className="text-white">Student Management</span>}
            icon={UserPlus}
          />
          <TabButton
            id="custom-types"
            label={<span className="text-white">Custom Types</span>}
            icon={Settings}
          />
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          {activeTab === "overview" && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-black mb-4">
                System Overview
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Recent Activity</h3>
                  <div className="text-sm text-gray-600">
                    <p>
                      • System is currently {isPaused ? "paused" : "active"}
                    </p>
                    <p>• {stats.totalRecords} academic records stored</p>
                    <p>• {stats.totalUniversities} universities registered</p>
                    {isSuperAdmin && (
                      <p>• {stats.totalAdmins} admins managing the system</p>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Quick Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => setActiveTab("universities")}
                      className="bg-blue-100 text-blue-700 hover:bg-blue-200"
                      variant={"outline"}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add University
                    </Button>
                    {isSuperAdmin && (
                      <Button
                        onClick={() => setActiveTab("admins")}
                        className="bg-green-100 text-green-700 hover:bg-green-200"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add Admin
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "universities" && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-black">
                  University Management
                </h2>
                <Button
                  onClick={() => setActiveTab("overview")}
                  className="bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Back to Overview
                </Button>
              </div>

              {/* Add University Form */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="font-medium mb-4 text-black">
                  Add New University
                </h3>
                <form
                  onSubmit={handleAddUniversity}
                  className="text-black grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                  <input
                    type="text"
                    placeholder="University Address (0x...)"
                    value={newUniversityAddress}
                    onChange={(e) => setNewUniversityAddress(e.target.value)}
                    className="px-4 py-2 text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    placeholder="University Name"
                    value={newUniversityName}
                    onChange={(e) => setNewUniversityName(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Button type="submit" disabled={loading} variant={"outline"}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add University
                  </Button>
                </form>
              </div>

              {/* Universities List */}
              <div className="space-y-4">
                <h3 className="font-medium text-black">
                  Registered Universities ({universities.length})
                </h3>
                {universities.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <School className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No universities registered yet</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {universities.map((uni, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {uni.name}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {truncateAddress(uni.address)}
                          </p>
                        </div>
                        {isSuperAdmin && (
                          <div className="flex space-x-2">
                            <Button
                              onClick={() =>
                                handleRemoveUniversity(uni.address)
                              }
                              className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1 text-sm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "admins" && isSuperAdmin && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-black">
                  Admin Management
                </h2>
                <Button
                  onClick={() => setActiveTab("overview")}
                  className="bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Back to Overview
                </Button>
              </div>

              {/* Add Admin Form */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6 text-black">
                <h3 className="font-medium mb-4">Add New Admin</h3>
                <form onSubmit={handleAddAdmin} className="flex gap-4">
                  <input
                    type="text"
                    placeholder="Admin Address (0x...)"
                    value={newAdminAddress}
                    onChange={(e) => setNewAdminAddress(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Button type="submit" disabled={loading}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Admin
                  </Button>
                </form>
              </div>

              {/* Admins List */}
              <div className="space-y-4">
                <h3 className="font-medium text-black">
                  System Admins ({admins.length})
                </h3>
                {admins.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-4 text-black" />
                    <p>No admins found</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {admins.map((admin, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 border text-black border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div>
                          <p className="font-medium text-black">
                            {truncateAddress(admin.address)}
                          </p>
                          <p className="text-sm text-black">Admin Role</p>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            onClick={() => handleRemoveAdmin(admin.address)}
                            className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1 text-sm"
                            disabled={admin.address === connectedAddress}
                          >
                            <UserMinus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "students" && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-black">
                  Student Management
                </h2>
                <Button
                  onClick={() => setActiveTab("overview")}
                  className="bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Back to Overview
                </Button>
              </div>

              {/* Register Student Form */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="font-medium mb-4 text-black">
                  Register Student
                </h3>
                <p className="text-sm text-black mb-4">
                  Register a student with their ID and wallet address. This will
                  allow them to access their records when they connect with
                  their wallet.
                </p>
                <form
                  onSubmit={handleRegisterStudent}
                  className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                  <input
                    type="text"
                    placeholder="Student ID"
                    value={newStudentId}
                    onChange={(e) => setNewStudentId(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    placeholder="Student Wallet Address (0x...)"
                    value={newStudentAddress}
                    onChange={(e) => setNewStudentAddress(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 text-black focus:ring-blue-500 focus:border-transparent"
                  />
                  <Button type="submit" variant="outline" disabled={loading}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Register Student
                  </Button>
                </form>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-blue-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      When you add a record for a student, make sure to use the
                      same Student ID that you register here. Students will be
                      able to see all records associated with their ID when they
                      connect with their registered wallet address.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "custom-types" && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-black">
                  Custom Record Types
                </h2>
                <Button
                  onClick={() => setActiveTab("overview")}
                  className="bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Back to Overview
                </Button>
              </div>

              {/* Add Custom Type Form */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="font-medium mb-4 text-black">
                  Add New Record Type
                </h3>
                <form
                  onSubmit={handleAddCustomType}
                  className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                  <input
                    type="text"
                    placeholder="Type Name"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    placeholder="Description"
                    value={newTypeDescription}
                    onChange={(e) => setNewTypeDescription(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Button type="submit" disabled={loading}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Type
                  </Button>
                </form>
              </div>

              {/* Custom Types List */}
              <div className="space-y-4">
                <h3 className="font-medium text-black">
                  Available Record Types
                </h3>
                <div className="grid gap-4">
                  {/* Default types */}
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">
                      Default Types
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {[
                        "Transcript",
                        "Degree",
                        "Marksheet",
                        "Diploma",
                        "Certificate",
                        "Provisional Certificate",
                        "Birth Certificate",
                        "Citizenship",
                        "National ID",
                        "Passport Copy",
                        "Character Certificate",
                      ].map((type, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-2 bg-gray-100 rounded-md text-sm text-gray-700"
                        >
                          {type}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Custom types would be listed here */}
                  {customTypes.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Settings className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No custom record types added yet</p>
                    </div>
                  ) : (
                    customTypes.map((type, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                      >
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {type.name}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {type.description}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Created by {truncateAddress(type.creator)} on{" "}
                            {new Date(
                              type.timestamp * 1000
                            ).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            className={`px-3 py-1 text-sm ${
                              type.isActive
                                ? "bg-red-100 text-red-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {type.isActive ? "Disable" : "Enable"}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
