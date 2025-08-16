import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEnhancedEdgeFunctions } from "@/hooks/useEnhancedEdgeFunctions";
import OrderDetails from "@/components/OrderDetails";
import {
  LogOut,
  Plus,
  Users,
  Package,
  Settings,
  Lock,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  RefreshCw,
  Target,
} from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { ArabicText } from "@/components/ui/arabic-text";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { OrderCard } from "@/components/orders/OrderCard";
import { EnhancedOrderCard } from "@/components/orders/EnhancedOrderCard";
import { OrderStatusDashboard } from "@/components/orders/OrderStatusDashboard";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useLanguage } from "@/contexts/LanguageContext";

import { AutoAssignButton } from "@/components/orders/AutoAssignButton";
import { EdgeFunctionStatus } from "@/components/debug/EdgeFunctionStatus";
import { EdgeFunctionFilter } from "@/components/admin/EdgeFunctionFilter";
import { RejectedOrdersPanel } from "@/components/admin/RejectedOrdersPanel";

import { Order } from "@/types/order";
import { OrderService } from "@/services/orderService";
import { formatCurrency, calculateFinalPrice } from "@/utils/currency";
import { deleteFakeOrders, checkForFakeOrders } from "@/utils/cleanupFakeOrders";
import {
  filterOrdersByStatus,
  calculateOrderStats,
  getOrderStatusLabel,
  isValidOrderStatus
} from "@/utils/orderFilters";
import { handleError, logError } from "@/utils/errorHandling";
import { StoreInventoryStatus } from "@/components/admin/StoreInventoryStatus";
import { StoreResponseNotification } from "@/components/admin/StoreResponseNotification";
import { RejectedOrdersManagement } from "@/components/admin/RejectedOrdersManagement";

// Environment variable for Edge Functions base URL
const EDGE_FUNCTIONS_BASE = import.meta.env.VITE_SUPABASE_EDGE_FUNCTIONS_BASE || 'https://wkzjovhlljeaqzoytpeb.supabase.co/functions/v1';

type Order = Tables<"orders">;
type Store = Tables<"stores">;

type OrderWithProduct = {
  order_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_city: string;
  product_name: string;
  product_price: number;
  store_name: string;
  assigned_store_name: string;
  main_store_name: string;
  created_at: string;
  order_code: string;
  order_status: string;
  assigned_store_id: string;
  store_response_status?: string;
  store_response_at?: string;
  rejection_reason?: string;
  total_amount: number;
  order_details: string;
  customer_notes: string;
  return_reason?: string;
  returned_at?: string;
  items: {
    name?: string;
    price?: number;
    quantity?: number;
    product_id?: number;
  }[] | null;
  order_items?: {
    id: string;
    product_name: string;
    quantity: number;
    price: number;
    discounted_price?: number;
    availability_status?: string;
    product_id?: string;
    products?: {
      id: string;
      name: string;
    };
  }[] | null;
  stores?: {
    name: string;
  };
};

const AdminDashboard = () => {
  const [orders, setOrders] = useState<OrderWithProduct[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStorePassword, setNewStorePassword] = useState("");
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState<string | null>(null);
  const [isToggleLoading, setIsToggleLoading] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);

  // Enhanced Edge Functions integration
  const {
    assignOrder: enhancedAssignOrder,
    autoAssignOrders: enhancedAutoAssignOrders,
    isAssigningOrder: isEnhancedAssigning,
    isAutoAssigning: isEnhancedAutoAssigning,
    autoAssignResults,
    clearAutoAssignResults,
    setAutoAssignResults // تم إضافة setAutoAssignResults لحل مشكلة "is not defined"
  } = useEnhancedEdgeFunctions();
  const [isCreatingStore, setIsCreatingStore] = useState(false);
  const [userSession, setUserSession] = useState<any>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, dir } = useLanguage();

  // دالة تشخيص لمراجعة بيانا�� الطلبا�� - ��جب ��ن تكون قبل أي conditional returns
  React.useEffect(() => {
    console.log("🔍 تشخيص شامل للطلبات:");
    console.log("📊 ��جمالي الطلبات:", orders.length);

    if (orders.length > 0) {
      // تجميع الطلبات حسب الحالة
      const statusGroups = orders.reduce((acc, order) => {
        const status = order.order_status || 'غير محدد';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log("📋 تفصيل الحالات الفعلية:", statusGroups);

      // حساب الإحصائيات للمراجعة
      const stats = calculateOrderStats(orders);
      console.log("📊 الإحصائيات المحسوبة:", stats);

      // تحلي�� الطلبات المعل��ة ��التفص��ل
      const pendingOrders = orders.filter(o =>
        o.order_status === "pending" ||
        o.order_status === "قيد الانتظار" ||
        o.order_status === null ||
        o.order_status === undefined ||
        o.order_status === ""
      );

      console.log("🔍 تحليل الطلبات المعلقة:", {
        count: pendingOrders.length,
        details: pendingOrders.map(o => ({
          id: o.order_id,
          status: o.order_status,
          statusType: typeof o.order_status,
          customer: o.customer_name
        }))
      });

      // عرض عين�� من البيانات للمراجعة
      console.log("📋 عينة طلب كامل:", orders[0]);
    } else {
      console.log("⚠️ لا توجد طلبات لعرضها");
    }
  }, [orders]); // تبسيط التبعيات

  // حذف الطلبات المزيفة من قاعدة البيانات
  const handleDeleteFakeOrders = async () => {
    try {
      setIsLoading(true);

      // التحقق من وج��د طلبات مزي��ة أولاً
      const checkResult = await checkForFakeOrders();

      if (!checkResult.found) {
        toast({
          title: "لا توجد طلبات مزيفة",
          description: "لم يتم العثور على أي طلبات مزيفة لحذفها",
        });
        return;
      }

      console.log(`🗑️ سيتم حذف ${checkResult.count} طلب مزيف`);

      // حذف الطلبات المزيفة
      const result = await deleteFakeOrders();

      if (result.success) {
        toast({
          title: "تم الحذف بنجاح",
          description: `تم حذف ${checkResult.count} طلب مزيف من قاعدة البيانات`,
        });

        // إعادة تحميل الطلبات
        await fetchOrders();
      } else {
        toast({
          title: "خطأ في الحذف",
          description: result.error || "فشل في حذف الطلبات المزيفة",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("❌ خطأ في حذف الطلبات المزيفة:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حذف الطلبات المزيفة",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log("🟢 AdminDashboard useEffect started");
    console.log("🔵 Current URL:", window.location.href);
    console.log("🔍 Environment check:", {
      supabase: !!supabase,
      localStorage: !!localStorage,
      navigate: !!navigate
    });

    const adminAuth = localStorage.getItem("adminAuth");
    console.log("🔵 adminAuth from localStorage:", adminAuth);
    
    if (!adminAuth) {
      console.log("❌ No adminAuth found, redirecting to login");
      navigate("/admin-login");
      return;
    }

    console.log("✅ adminAuth found, proceeding with dashboard initialization");

    // Get current session and listen for changes
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("الجلسة الحالية Current session:", session);
      setUserSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("🔵 Auth state changed:", event, session);
        setUserSession(session);
        if (event === 'SIGNED_OUT') {
          localStorage.removeItem("adminAuth");
          navigate("/admin-login");
        }
      }
    );

    // Load initial data
    console.log("🚀 Starting to load initial data...");

    // حل مؤقت: إذا لم تنتهي عملية التحميل في 10 ثواني، اعتبرها منتهية
    const loadingTimeout = setTimeout(() => {
      console.warn("⚠️ Loading timeout reached, forcing isLoading to false");
      setIsLoading(false);
    }, 10000);

    Promise.all([
      fetchOrders().catch(e => console.error("❌ fetchOrders failed:", e)),
      fetchStores().catch(e => console.error("❌ fetchStores failed:", e)),
      fetchSettings().catch(e => console.error("❌ fetchSettings failed:", e))
    ]).finally(() => {
      clearTimeout(loadingTimeout);
      setIsLoading(false);
      console.log("✅ All initial data loading completed");
    });

    // إعداد ا��تراك في الوقت الفعلي لتحديثات ا��طلبات
    const ordersChannel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('🔄 تحديث في الوقت الفعلي للطلب:', payload);

          // تحقق من التحديثات المهمة
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;

          if (newRecord.store_response_status !== oldRecord.store_response_status) {
            console.log('✅ Store response status changed:', {
              orderId: newRecord.id,
              old: oldRecord.store_response_status,
              new: newRecord.store_response_status
            });

            // ��عادة تحميل الطلبات مع إشعار
            fetchOrders();

            toast({
              title: "تحديث حالة المخزون",
              description: `تم تحدي�� حالة ��لمخزون للطلب ${newRecord.order_code || newRecord.id.slice(0, 8)}`,
            });
          }
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      subscription.unsubscribe();
      ordersChannel.unsubscribe();
    };
  }, [navigate]);

  const fetchOrders = async () => {
    try {
      setIsOrdersLoading(true);
      console.log("🔵 fetchOrders started");
      console.log("🔵 Supabase client available:", !!supabase);

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          customer_name,
          customer_phone,
          customer_address,
          customer_city,
          customer_notes,
          main_store_name,
          assigned_store_id,
          status,
          order_status,
          store_response_status,
          store_response_at,
          rejection_reason,
          total_amount,
          subtotal,
          order_code,
          order_details,
          items,
          created_at,
          updated_at,
          order_items:order_items(
            id,
            product_name,
            quantity,
            price,
            discounted_price,
            availability_status,
            product_id,
            products:product_id(
              id,
              name
            )
          ),
          stores!assigned_store_id(name)
        `)
        .order('created_at', { ascending: false });

      console.log("🔵 fetchOrders raw response:", {
        dataLength: data?.length,
        error: error,
        firstItem: data?.[0]
      });

      // تشخيص إضافي لفهم بنية البيانات
      if (data && data.length > 0) {
        console.log("🔍 تحليل بيانات الطلبات:");
        data.forEach((order, index) => {
          if (index < 3) { // عرض أول 3 طلبات فقط
            console.log(`طلب ${index + 1}:`, {
              id: order.id,
              status: order.status,
              order_status: order.order_status,
              customer_name: order.customer_name
            });
          }
        });
      }

      if (error) {
        console.error("❌ Supabase query error:", error);
        console.error("❌ Error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        // في حالة الخطأ، لا �����ت��دم بيانات ��جريب��ة - أظهر ��ائمة فارغة
        console.log("🔄 Database error - showing empty list");
        setOrders([]);
        return;
      }

      console.log("✅ Orders fetched successfully:", {
        count: data?.length || 0,
        sample: data?.[0],
      });

      // ��طبيع البيانات للتعامل مع حقول الحالة المختلفة
      const normalizedData = data?.map(order => {
        // استخدام order_status كحقل أساسي، مع الاعتماد على status كبديل
        const normalizedStatus = order.order_status || order.status || 'pending';

        return {
          ...order,
          order_id: order.id, // تحويل id إلى order_id للتوافق
          order_status: normalizedStatus,
          // تأكد من وجود القيم الأساسية
          customer_name: order.customer_name || 'غير محد��',
          total_amount: Number(order.total_amount) || 0
        };
      }) || [];

      console.log("🔄 Data normalized:", {
        count: normalizedData.length,
        statusDistribution: normalizedData.reduce((acc, order) => {
          acc[order.order_status] = (acc[order.order_status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        storeResponseStatuses: normalizedData.map(order => ({
          id: order.id,
          store_response_status: order.store_response_status,
          assigned_store_id: order.assigned_store_id
        })).filter(o => o.store_response_status)
      });

      // Process orders with currency conversion
      const processedOrders = normalizedData.length > 0 ? OrderService.processOrderData(normalizedData) : [];
      console.log("🔄 Orders processed:", {
        count: processedOrders.length,
        sampleProcessed: processedOrders[0]
      });

      setOrders(processedOrders);
    } catch (error) {
      console.log("🔄 Error fetching orders - showing empty list");
      setOrders([]);

      handleError(
        'تحميل الطلبات',
        error,
        toast
      );
    } finally {
      setIsOrdersLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      console.log("🔵 fetchStores started");
      console.log("🔗 Supabase client:", supabase ? 'available' : 'not available');

      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .order("name");

      console.log("🔵 fetchStores raw response:", { data, error });

      if (error) {
        console.error("❌ Error fetching stores:", error);
        console.error("🔍 Error details:", { message: error.message, details: error.details, hint: error.hint });
        throw error;
      }

      console.log("✅ Stores fetched successfully:", data?.length || 0, "stores");
      setStores(data || []);
    } catch (error) {
      console.error("❌ Error fetching stores:", error);
      console.error("❌ Full error object:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });

      toast({
        title: "خطأ",
        description: "فشل في تحم��ل المتاجر",
        variant: "destructive",
      });
    } finally {
      console.log("🔵 fetchStores completed");
    }
  };

  const fetchSettings = async () => {
    try {
      console.log("⚙️ fetchSettings started");
      const { data, error } = await supabase
        .from("settings")
        .select("auto_assign_enabled")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("❌ Error fetching settings:", error);
        throw error;
      }
      
      console.log("✅ Settings fetched:", data);
      if (data) {
        setAutoAssignEnabled(data.auto_assign_enabled);
      }
    } catch (error) {
      console.error("❌ Error fetching settings:", error);
    }
  };

  const handleAssignOrder = async (orderId: string, storeId: string) => {
    try {
      setIsAssigning(orderId);

      // 🟢 لو�� م��صل لل��أكد من ���لقيم قب�� الطلب
      console.log('🔵 Assign Order:', { orderId, storeId });
      console.log('📦 Sending assignment request:');
      console.log('orderId:', orderId, typeof orderId);
      console.log('storeId:', storeId, typeof storeId);
      console.log('Request body:', JSON.stringify({ orderId, storeId }));
      console.log('URL:', 'https://wkzjovhlljeaqzoytpeb.supabase.co/functions/v1/auto-assign-orders (manual mode)');

      // تأكد من أن القيم ليست undefined
      if (!orderId || !storeId) {
        console.error('❌ Missing values:', { orderId, storeId });
        toast({
          title: "خطأ في البيانات",
          description: "معرف الطلب أو معرف المتجر غير صحيح",
          variant: "destructive",
        });
        return;
      }

      // التحقق من وجود البيان��ت المطلوبة
      console.log('📊 Current state:', {
        ordersCount: orders.length,
        storesCount: stores.length,
        targetOrder: orders.find(o => o.order_id === orderId),
        targetStore: stores.find(s => s.id === storeId)
      });

      const targetStore = stores.find(s => s.id === storeId);
      if (!targetStore) {
        console.error('❌ Store not found:', { storeId, availableStores: stores.map(s => ({ id: s.id, name: s.name })) });
        toast({
          title: "خطأ",
          description: `المتجر المحدد غير موجود (ID: ${storeId})`,
          variant: "destructive",
        });
        return;
      }

      const targetOrder = orders.find(o => o.order_id === orderId);
      if (!targetOrder) {
        console.error('❌ Order not found:', { orderId, availableOrders: orders.map(o => ({ id: o.order_id, status: o.order_status })) });
        toast({
          title: "خطأ",
          description: `الطلب المحدد غير موجود (ID: ${orderId.substring(0, 8)}...)`,
          variant: "destructive",
        });
        return;
      }

      console.log('✅ Pre-assignment validation passed:', {
        order: { id: targetOrder.order_id, status: targetOrder.order_status, customer: targetOrder.customer_name },
        store: { id: targetStore.id, name: targetStore.name }
      });

      const res = await fetch(`${EDGE_FUNCTIONS_BASE}/auto-assign-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderId, storeId, mode: 'manual' })
      });

      console.log('📨 Response status:', res.status, res.statusText);
      console.log('📋 Response headers:', Object.fromEntries(res.headers.entries()));

      // Read response only once and store it
      const data = await res.json();

      if (!res.ok) {
        console.error('🔴 Edge Function Error:', data);
        console.error('📄 Full response:', { status: res.status, statusText: res.statusText, error: data });
        toast({
          title: "خطأ في التعيين",
          description: data.error || res.statusText || "فشل في تعيين الطلب",
          variant: "destructive",
        });
        return;
      }
      console.log('✅ Order assigned successfully:', data);

      if (data.success) {
        const storeName = data.store_name || targetStore.name;
        toast({
          title: "تم التعيين بنجاح",
          description: data.message || `تم تعيين الطلب إلى متجر "${storeName}"`
        });

        // تحديث الطلب محلياً دون إعادة جلب كل البيانات
        setOrders(prev => prev.map(order =>
          order.order_id === orderId
            ? {
                ...order,
                order_status: 'assigned',
                assigned_store_id: storeId,
                assigned_store_name: storeName
              }
            : order
        ));

        console.log('🎉 Order assignment completed successfully:', {
          orderId: orderId.substring(0, 8) + '...',
          storeName: storeName,
          newStatus: 'assigned'
        });
      } else {
        toast({
          title: "خطأ",
          description: data.error || "فشل في تعيين الطلب",
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('🔴 Error in handleAssignOrder:', {
        error: error,
        message: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        orderId: orderId,
        storeId: storeId,
        timestamp: new Date().toISOString()
      });

      const errorMessage = error instanceof Error
        ? error.message
        : typeof error === 'string'
        ? error
        : "فشل الاتصال بالسيرفر";

      toast({
        title: "خطأ في الاتصال",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsAssigning(null);
    }
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim() || !newStorePassword.trim()) return;

    try {
      setIsCreatingStore(true);
      const { error } = await supabase.from("stores").insert([
        {
          name: newStoreName.trim(),
          password: newStorePassword.trim(),
        },
      ]);

      if (error) throw error;

      toast({
        title: "تم إنشاء المتجر",
        description: `تم إنشاء متجر "${newStoreName}" بنجاح`,
      });

      setNewStoreName("");
      setNewStorePassword("");
      fetchStores();
    } catch (error) {
      console.error("Error creating store:", error);
      toast({
        title: "خطأ",
        description: "فشل في إنشاء المتجر",
        variant: "destructive",
      });
    } finally {
      setIsCreatingStore(false);
    }
  };

  const handleToggleAutoAssign = async () => {
    const adminAuth = localStorage.getItem("adminAuth");
    if (!adminAuth) {
      toast({
        title: "خطأ",
        description: "يجب أن تكون مسجل الدخول كمشرف",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsToggleLoading(true);

      const newValue = !autoAssignEnabled;
      console.log('���� Updating auto-assign setting:', { current: autoAssignEnabled, new: newValue });

      // إ����ا كان المستخد�� يفعل التعيين ال��لقائي، ��فذ التعيين أول��ً
      if (newValue) {
        console.log('🚀 Starting auto-assignment process with notifications...');

        // عد الطلبات ال��علقة قبل ��لتعيين
        const pendingOrdersCount = getOrdersByStatus("pending").length;
        const autoAssignableCount = getAutoAssignableOrdersCount();

        if (autoAssignableCount === 0) {
          toast({
            title: "لا توج�� طلبات للتعيين",
            description: "جميع الطلبات المعلقة معينة أو لا تحت��ي على اسم متجر رئي���ي",
            variant: "default",
          });
          // تحديث الإعداد فقط
          const { error } = await supabase.from("settings").upsert({
            id: 1,
            auto_assign_enabled: newValue,
            updated_at: new Date().toISOString(),
          });
          if (!error) {
            setAutoAssignEnabled(newValue);
          }
          return;
        }

        // عرض رسالة بدء التعيين
        toast({
          title: "🚀 بدء التعيين التلقائي",
          description: `بدء تعيين ${autoAssignableCount} ط��ب من أ�����ل ${pendingOrdersCount} طلب ��علق...`,
        });

        // تنفي�� التعيين التلقائي مع الإشعارات
        const response = await fetch(`${EDGE_FUNCTIONS_BASE}/auto-assign-orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        // Read response only once and store it
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'فشل في التعيين التلقائي');
        }
        console.log('✅ Auto-assignment completed with notifications:', result);

        const assignedCount = result.assigned_count || 0;
        const unmatchedCount = result.unmatched_count || 0;
        const errorCount = result.error_count || 0;
        const notificationResults = result.results || [];

        // حساب عدد الإشعا����ات المرسلة
        const notifiedCount = notificationResults.filter(r => r.notified === true).length;
        const notificationFailedCount = notificationResults.filter(r => r.status === 'assigned' && r.notified !== true).length;

        // إعداد رس��لة النتيجة
        let detailedMessage = `���� ت���� تعيي�� ${assignedCount} طلب بنج��ح`;
        if (notifiedCount > 0) {
          detailedMessage += `\n��� تم إرسال ${notifiedCount} إشعار`;
        }
        if (notificationFailedCount > 0) {
          detailedMessage += `\n⚠️ ${notificationFailedCount} متجر بدون إيميل - لم يتم إرسال إشعار`;
        }
        if (unmatchedCount > 0) {
          detailedMessage += `\n🔍 ${unmatchedCount} طلب لم يتم العثور على متجر مطابق`;
        }
        if (errorCount > 0) {
          detailedMessage += `\n❌ ${errorCount} طلب حدث بها خطأ`;
        }

        // عرض نت��جة مفصلة
        toast({
          title: "✅ تم التعيين التلقائي مع الإشع��رات",
          description: detailedMessage,
        });

        // حف�� نتائج التعيين لعرضها
        setAutoAssignResults({
          assigned_count: assignedCount,
          unmatched_count: unmatchedCount,
          error_count: errorCount,
          notified_count: notifiedCount,
          notification_failed_count: notificationFailedCount
        });

        // إ��ادة تحميل الطلبات
        await fetchOrders();
      }

      // تحديث إعدا�� ق��عدة البيانا��
      const { error } = await supabase.from("settings").upsert({
        id: 1,
        auto_assign_enabled: newValue,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error('❌ Error updating settings:', error);
        throw error;
      }

      console.log('✅ Auto-assign setting updated successfully to:', newValue);
      setAutoAssignEnabled(newValue);

      if (!newValue) {
        toast({
          title: "تم إلغاء التعيين التلقائي",
          description: "لن يتم تعي����� الطلبات الجديدة تلقائياً",
        });
        // ��سح ن��ائ�� التعيين السابقة
        setAutoAssignResults(null);
      }

    } catch (error) {
      console.error("Error in handleToggleAutoAssign:", error);
      toast({
        title: "خطأ في التعيي�� التلقائي",
        description: error instanceof Error ? error.message : "فشل في تحديث الإعدادات",
        variant: "destructive",
      });
    } finally {
      setIsToggleLoading(false);
    }
  };

  const handleAutoAssignOrders = async () => {
    try {
      setIsAutoAssigning(true);

      console.log('🔎 Calling auto-assign-orders (bulk mode)');

      const res = await fetch(`${EDGE_FUNCTIONS_BASE}/auto-assign-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      console.log('📨 Auto-assign response status:', res.status, res.statusText);

      // Read response only once and store it
      const data = await res.json();

      if (!res.ok) {
        console.error('🔴 Auto-assign Error:', data);
        toast({
          title: "خطأ في التعيين التلقائي",
          description: data.error || res.statusText || "فشل في التعيين الت���قائي",
          variant: "destructive",
        });
        return;
      }
      console.log('✅ Auto-assign completed:', data);

      if (data.success) {
        const assignedCount = data.assigned_count || 0;
        const unmatchedCount = data.unmatched_count || 0;
        const errorCount = data.error_count || 0;

        let message = `تم تعيين ${assignedCount} طلب بنجاح`;
        if (unmatchedCount > 0) {
          message += `\n${unmatchedCount} ط��ب لم يتم العثور على متجر مطابق`;
        }
        if (errorCount > 0) {
          message += `\n${errorCount} طلب حدث ��هم خطأ`;
        }



        toast({
          title: "تم التعيين التلقائي",
          description: message,
        });

        // إعادة تحميل الطلبات
        console.log('���� Refreshing orders after auto-assign...');
        await fetchOrders();
      } else {
        toast({
          title: "فشل في التعيين الت��قائي",
          description: data.error || 'خطأ غير محدد',
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('���� Error in handleAutoAssignOrders:', error);

      toast({
        title: "خطأ في التعيين التلقائي",
        description: error instanceof Error ? error.message : "فشل الاتصال بالسيرفر للتعيين التلقائي",
        variant: "destructive",
      });
    } finally {
      setIsAutoAssigning(false);
    }
  };

  // دالة التعيين التلقائي المحسنة مع التنبيهات بالعربية
  const handleAutoAssignOrdersWithAlert = async () => {
    try {
      setIsAutoAssigning(true);

      console.log('🔎 Calling enhanced auto-assign-orders (bulk mode) with Arabic alerts');

      const response = await fetch(`${EDGE_FUNCTIONS_BASE}/auto-assign-orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });

      // Read response only once and store it
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "حدث خطأ أثناء التعيين ال��لقائي");
      }

      // عرض الن��ائج بالعربية
      const assignedCount = result.assigned_count || 0;
      const totalOrders = result.total_orders || 0;

      alert(`✅ تم تعيين ${assignedCount} من أصل ${totalOrders} طلب بنجاح`);
      console.log("📦 النت����ئج:", result);

      // إعادة تحميل الطلبات
      console.log('🔄 Refreshing orders after auto-assign...');
      await fetchOrders();

      // ��رض toast إضافي
      toast({
        title: "تم التعي��ن التلقائي بنجاح",
        description: `تم تعيين ${assignedCount} ��ن أصل ${totalOrders} طلب`,
      });

    } catch (error) {
      console.error("تفاصيل الخطأ:", error);
      alert("❌ فشل التعيين التلقائي: " + (error instanceof Error ? error.message : "خطأ غير ����عروف"));

      toast({
        title: "فشل ا��تعيين التلقائ��",
        description: error instanceof Error ? error.message : "حدث خ��أ غير مت��قع",
        variant: "destructive",
      });
    } finally {
      setIsAutoAssigning(false);
    }
  };

  // دال���� لتحو��ل طلب و��حد تلقائي��ً إل�� المتجر المناسب
  const handleAutoAssignSingleOrder = async (order: OrderWithProduct) => {
    if (!order.main_store_name) {
      toast({
        title: "خطأ",
        description: "لا يم��ن تحديد المتجر المناسب لهذا الطلب",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAssigning(order.order_id);

      // البحث عن المتجر الم����ابق لاسم المتجر الرئيسي
      const matchingStore = stores.find(store =>
        store.name.toLowerCase().trim() === order.main_store_name.toLowerCase().trim()
      );

      if (!matchingStore) {
        toast({
          title: "لم يتم العثور على المتجر",
          description: `لا يوجد متجر مطابق لـ "${order.main_store_name}"`,
          variant: "destructive",
        });
        return;
      }

      console.log('🎯 ت��ويل تلقائي للطلب:', {
        orderId: order.order_id,
        mainStoreName: order.main_store_name,
        matchingStore: matchingStore.name,
        storeId: matchingStore.id
      });

      // ا��تخدام دالة handleAssignOrder المحسنة بدلاً من enhancedAssignOrder
      console.log('🚀 Using improved handleAssignOrder for auto-assignment');
      await handleAssignOrder(order.order_id, matchingStore.id);

    } catch (error) {
      console.error('❌ Error in auto-assign single order:', error);
      toast({
        title: "خطأ في ��لتحويل",
        description: "فشل في تحويل الطلب إلى ��لمتجر المناسب",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(null);
    }
  };

  const handleViewOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setShowOrderDetails(true);
  };

  const handleCloseOrderDetails = () => {
    setShowOrderDetails(false);
    setSelectedOrderId(null);
  };

  const handleOrderUpdated = () => {
    fetchOrders();
  };

  const handleLogout = async () => {
    localStorage.removeItem("adminAuth");
    await supabase.auth.signOut();
    navigate("/admin-login");
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      pending: {
        label: "معلقة",
        message: "⏳ في الانتظار: لم يتم تعيين ه���� الطلب لأي متجر بعد.",
        variant: "secondary" as const,
        icon: Clock,
      },
      assigned: {
        label: t('assigned'),
        message: `📦 ${t('order')} ${t('assigned')} إل�� المتجر، جاري المعالجة.`,
        variant: "default" as const,
        icon: Package,
      },
      delivered: {
        label: t('delivered'),
        message: `✅ تم تسليم ${t('order')} بنجاح.`,
        variant: "default" as const,
        icon: CheckCircle,
      },
      completed: {
        label: t('delivered'),
        message: `✅ تم تسليم ${t('order')} بنجاح.`,
        variant: "default" as const,
        icon: CheckCircle,
      },
      returned: {
        label: t('returned'),
        message: `🔄 تم إرجاع ${t('order')}.`,
        variant: "destructive" as const,
        icon: XCircle,
      },
    };

    return (
      statusMap[status as keyof typeof statusMap] || {
        label: status,
        message: `⚠️ حالة غير معروفة: ${status}`,
        variant: "secondary" as const,
        icon: Package,
      }
    );
  };

  const getOrdersByStatus = (status: string) => {
    console.log(`🔍 تص��ية الطلبات ح��ب الحالة: ${status}`, {
      totalOrders: orders.length,
      orderStatuses: orders.map(o => o.order_status)
    });

    // معالجة ��ا��ة للطلب��ت المعلقة مع تج��بة قيم مختلفة
    if (status === "pending") {
      const pendingOrders = orders.filter(order =>
        order.order_status === "pending" ||
        order.order_status === "ق��د الانتظار" ||
        order.order_status === null ||
        order.order_status === undefined ||
        order.order_status === ""
      );

      console.log(`📊 الطلبات المعلقة الموجودة:`, {
        count: pendingOrders.length,
        orders: pendingOrders.map(o => ({
          id: o.order_id,
          status: o.order_status,
          customer: o.customer_name
        }))
      });

      return pendingOrders;
    }

    // استخدام الدالة الموحدة للتصنيف للحا��ات الأخرى
    if (isValidOrderStatus(status)) {
      const filtered = filterOrdersByStatus(orders, status);
      console.log(`📊 طلبات ${status}:`, filtered.length);
      return filtered;
    }

    console.warn(`⚠️ محاولة تصفية بحالة غير صحيحة: ${status}`);
    return [];
  };

  // Convert OrderWithProduct to Order type for new components
  const convertToOrder = (order: OrderWithProduct): Order => {
    const baseOrder = {
      id: order.order_id,
      order_code: order.order_code,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_address: order.customer_address,
      customer_city: order.customer_city,
      customer_notes: order.customer_notes,
      order_details: order.order_details,
      order_status: order.order_status as Order['order_status'],
      assigned_store_id: order.assigned_store_id,
      assigned_store_name: order.assigned_store_name,
      main_store_name: order.main_store_name,
      store_response_status: order.store_response_status,
      store_response_at: order.store_response_at,
      rejection_reason: order.rejection_reason,
      items: order.items,
      order_items: order.order_items, // إضافة order_items لعرض أسماء المنتجات
      total_amount: order.total_amount,
      created_at: order.created_at
    };

    // Apply currency conversion through OrderService
    return OrderService.normalizeOrderAmounts(baseOrder);
  };

  const getOrderStats = () => {
    // استخدام الدالة الموحدة لحساب ا��إحصائيات
    return calculateOrderStats(orders);
  };

  // حساب ع��د الطلبات التي ي��كن تحويلها تلقائ��اً
  const getAutoAssignableOrdersCount = () => {
    const pendingOrders = getOrdersByStatus("pending");
    return pendingOrders.filter(order => {
      if (!order.main_store_name) return false;
      return stores.some(store =>
        store.name.toLowerCase().trim() === order.main_store_name.toLowerCase().trim()
      );
    }).length;
  };

  const renderOrderCard = (order: OrderWithProduct) => {
    // تحقق من صحة البيانات قبل العرض
    if (!order.order_id || !order.customer_name) {
      console.error("بيانات الطلب غير مكتملة:", order);
      return (
        <div key={`error-${order.order_id || 'unknown'}`} className="p-4 border border-red-200 rounded bg-red-50">
          <p className="text-red-600 text-sm">بي��نات الطل�� غير مكتملة</p>
          <pre className="text-xs text-gray-600 mt-2">{JSON.stringify(order, null, 2)}</pre>
        </div>
      );
    }

    try {
      const convertedOrder = convertToOrder(order);
      const isPending = order.order_status === "pending";

      return (
        <ErrorBoundary key={order.order_id}>
          <div className="bg-card border rounded-lg p-4 space-y-4">
            <EnhancedOrderCard
              order={convertedOrder}
              onViewDetails={(orderId) => handleViewOrder(orderId)}
              onAssign={async (orderId, storeId) => {
                await handleAssignOrder(orderId, storeId);
              }}
              showAssignButton={isPending}
              compact={false}
            />

            {/* ��ر التحويل التلقائي للط��بات المعلقة */}
            {isPending && (
              <div className="pt-3 border-t">
                <div className="text-xs text-muted-foreground mb-2 font-medium">
                  <ArabicText>تحويل سريع:</ArabicText>
                </div>
                <AutoAssignButton
                  order={order}
                  stores={stores}
                  onAutoAssign={handleAutoAssignSingleOrder}
                  isAssigning={isAssigning === order.order_id}
                  disabled={isAssigning === order.order_id || isEnhancedAssigning}
                />
              </div>
            )}
          </div>
        </ErrorBoundary>
      );
    } catch (error) {
      console.error("خطأ في عرض الطل��:", error, order);
      return (
        <div key={`error-${order.order_id}`} className="p-4 border border-red-200 rounded bg-red-50">
          <p className="text-red-600 text-sm">خطأ ف�� ��رض الطلب: {order.order_id}</p>
          <p className="text-xs text-gray-600 mt-1">{error instanceof Error ? error.message : 'خطأ غير معروف'}</p>
        </div>
      );
    }
  };

  const renderOrderCardOld = (order: OrderWithProduct) => (
    <div
      key={order.order_id}
      className="flex flex-col lg:flex-row lg:items-start lg:justify-between p-4 lg:p-6 border rounded-lg bg-card shadow-sm hover:shadow-md transition-shadow gap-4"
    >
      <div className="flex-1">
        <div className="bg-card border rounded-lg p-4 flex flex-col">
          {/* رأس الطلب */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 pb-3 border-b gap-2">
            <h3 className="font-bold text-lg text-primary">
              طلب #{order.order_code || order.order_id.slice(0, 8)}
            </h3>
            <div className="flex items-center gap-2">
              <Badge {...getStatusBadge(order.order_status || "pending")}>
                {getStatusBadge(order.order_status || "pending").label}
              </Badge>
            </div>
          </div>

          {/* معلومات مختصرة */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="font-semibold text-blue-600 min-w-[80px]">اسم العميل:</span>
                <span className="font-medium">{order.customer_name || "غير محدد"}</span>
              </div>

              <div className="flex items-start gap-2">
                <span className="font-semibold text-blue-600 min-w-[80px]">📞 الهاتف:</span>
                <span className="font-medium" dir="ltr">{order.customer_phone || "غير محدد"}</span>
              </div>

              <div className="flex items-start gap-2">
                <span className="font-semibold text-indigo-600 min-w-[80px]">📍 العنوان:</span>
                <span className="font-medium">{order.customer_address || "غير محدد"}</span>
              </div>

              <div className="flex items-start gap-2">
                <span className="font-semibold text-pink-600 min-w-[80px]">📝 ملاحظات:</span>
                <span className="font-medium">{order.customer_notes || "لا توجد"}</span>
              </div>

              {order.return_reason && order.order_status === 'returned' && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <span className="font-semibold text-red-600 min-w-[80px]">🔄 سبب الإرجاع:</span>
                  <span className="font-medium text-red-700">{order.return_reason}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="font-semibold text-green-600 min-w-[80px]">💰 المبلغ:</span>
                <span className="text-green-700 font-bold">
                  {order.total_amount ? formatCurrency(order.total_amount) : "غير محدد"}
                </span>
              </div>
              
              <div className="flex items-start gap-2">
                <span className="font-semibold text-purple-600 min-w-[80px]">🏪 المتجر الرئيسي:</span>
                <span className="font-medium text-blue-600">
                  {order.main_store_name || "غير محدد"}
                </span>
              </div>

              {order.assigned_store_name && (
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-green-600 min-w-[80px]">🎯 المتجر المعين:</span>
                  <span className="font-medium text-green-600">
                    {order.assigned_store_name}
                  </span>
                </div>
              )}

              {/* حالة المخزون من المتجر */}
              {order.assigned_store_name && (
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-blue-600 min-w-[80px]">
                    {order.store_response_status === 'available' || order.store_response_status === 'accepted'
                      ? '✅ حالة التوفر:'
                      : order.store_response_status === 'unavailable' || order.store_response_status === 'rejected'
                      ? '❌ حالة التوفر:'
                      : '⏳ حالة التوفر:'
                    }
                  </span>
                  <div className="flex-1">
                    <span className={`font-medium ${
                      order.store_response_status === 'available' || order.store_response_status === 'accepted'
                        ? 'text-green-600'
                        : order.store_response_status === 'unavailable' || order.store_response_status === 'rejected'
                        ? 'text-red-600'
                        : 'text-yellow-600'
                    }`}>
                      {order.store_response_status === 'available' || order.store_response_status === 'accepted'
                        ? t('available')
                        : order.store_response_status === 'unavailable' || order.store_response_status === 'rejected'
                        ? t('unavailable')
                        : t('waiting.for.store.response')
                      }
                    </span>
                    <div className="text-xs text-gray-600 mt-1">
                      المتجر المعين: {order.assigned_store_name}
                    </div>
                    {order.store_response_at && (
                      <div className="text-xs text-gray-500 mt-1">
                        تم الرد: {new Date(order.store_response_at).toLocaleDateString('ar-IQ')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2">
                <span className="font-semibold text-gray-600 min-w-[80px]">🆔 الطلب:</span>
                <span className="font-medium">{order.order_code || "غير محدد"}</span>
              </div>

              <div className="flex items-start gap-2">
                <span className="font-semibold text-gray-600 min-w-[80px]">📅 التاريخ:</span>
                <span className="font-medium">
                  {new Date(order.created_at).toLocaleString("ar-EG", {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    hour12: true
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* حالة الطلب */}
          <div className="mt-4 pt-4 border-t">
            <h4 className="font-semibold text-sm mb-2">📊 حالة الطلب:</h4>
            <div className="flex items-center gap-2">
              <span className="font-medium">{getStatusBadge(order.order_status || "pending").label}</span>
              <span className="text-sm text-muted-foreground">
                {getStatusBadge(order.order_status || "pending").message}
              </span>
            </div>
          </div>

          {/* عناصر الطلب - تفاصيل المنتجات */}
          {order.items && order.items.length > 0 ? (
            <div className="mt-4 pt-4 border-t">
              <h4 className="font-semibold text-sm mb-3 text-blue-700">
                منتجات الطلب ({order.items.length} منتج)
              </h4>
              <div className="space-y-2">
                {order.items.map((item, i) => (
                  <div key={i} className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 text-sm">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-semibold text-blue-800 mb-1">
                          {item.product_name || item.name || 'منتج غير محدد'}
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          {(() => {
                            const originalPrice = item.price || 0;
                            const discountedPrice = item.discounted_price || 0;
                            const priceInfo = discountedPrice > 0 && discountedPrice < originalPrice
                              ? {
                                  finalPrice: discountedPrice,
                                  hasDiscount: true,
                                  discountAmount: originalPrice - discountedPrice,
                                  savings: originalPrice - discountedPrice
                                }
                              : {
                                  finalPrice: originalPrice,
                                  hasDiscount: false,
                                  discountAmount: 0,
                                  savings: 0
                                };
                            return (
                              <div className="font-medium">
                                {priceInfo.hasDiscount ? (
                                  <div>
                                    <div className="text-red-600">
                                      السعر بعد الخصم: {formatCurrency(priceInfo.finalPrice)}
                                    </div>
                                    <div className="text-gray-500 line-through text-xs">
                                      السعر الأصلي: {formatCurrency(item.price || 0)}
                                    </div>
                                    <div className="text-green-600 text-xs">
                                      وفرت: {formatCurrency(priceInfo.savings)}
                                    </div>
                                  </div>
                                ) : (
                                  <div>السعر: {item.price ? formatCurrency(item.price) : 'غير محدد'}</div>
                                )}
                              </div>
                            );
                          })()}
                          <div className="font-medium">
                            الكمية: {item.quantity || 1}
                          </div>
                          {item.description && (
                            <div className="text-gray-500 italic">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="font-bold text-green-700">
                        {(() => {
                          const originalPrice = item.price || 0;
                          const discountedPrice = item.discounted_price || 0;
                          const priceInfo = discountedPrice > 0 && discountedPrice < originalPrice
                            ? {
                                finalPrice: discountedPrice,
                                hasDiscount: true,
                                discountAmount: originalPrice - discountedPrice,
                                savings: originalPrice - discountedPrice
                              }
                            : {
                                finalPrice: originalPrice,
                                hasDiscount: false,
                                discountAmount: 0,
                                savings: 0
                              };
                          const totalPrice = priceInfo.finalPrice * (item.quantity || 1);
                          return item.price && item.quantity ? formatCurrency(totalPrice) : 'غير محدد';
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t border-blue-200">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-700">إجمالي الطلب:</span>
                  <span className="font-bold text-lg text-green-700">
                    {formatCurrency(order.total_amount)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 pt-4 border-t">
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Package className="w-5 h-5 text-yellow-600" />
                  <p className="text-sm text-yellow-700 font-medium">تفاصيل المنتجات غير متاحة</p>
                </div>
                <p className="text-xs text-yellow-600">لعرض تفاصيل المنتجات انق�� على زر "تفاصيل" لفت�� ��افذة التفاصي�� الكاملة</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewOrder(order.order_id)}
                  className="mt-2 text-xs"
                >
                  👁️ عرض تفاصيل المنتجات
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {order.order_status === "pending" && (
        <div className="w-full lg:w-auto lg:mr-4 flex flex-col items-stretch lg:items-center gap-2 lg:min-w-[160px]">
          <div className="text-xs text-muted-foreground font-medium text-center">
            تعيين إلى متجر
          </div>
          <Select
            onValueChange={(storeId) =>
              handleAssignOrder(order.order_id, storeId)
            }
            disabled={isAssigning === order.order_id || isEnhancedAssigning}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={
                (isAssigning === order.order_id || isEnhancedAssigning) ? "جاري التعيين..." : "اختر متجر"
              } />
            </SelectTrigger>
            <SelectContent>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );

  if (isLoading) {
    console.log("🔵 Showing loading screen, isLoading =", isLoading);
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <div className="text-lg">جاري التحميل...</div>
        <div className="text-sm text-muted-foreground">
          جاري تح��يل البيانات، يرجى المراجعة في وحدة تحكم المطور (F12) للمزيد من التفاصيل
        </div>
      </div>
    );
  }

  const stats = getOrderStats();

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 p-6 arabic-text"
      dir={dir}
    >
      {/* إشعارات ردود المتاجر */}
      <StoreResponseNotification />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-primary">
              {t('admin.dashboard')}
            </h1>
            <p className="text-muted-foreground">
              {t('admin.stores.management')}
            </p>

            {/* Debug: Show orders with store responses */}
            {process.env.NODE_ENV === 'development' && orders.length > 0 && (
              <div className="mt-2 text-xs text-gray-600 grid grid-cols-2 gap-2">
                <div>📊 <span className="font-medium">{t('total.assigned.orders')}:</span> {orders.filter(o => o.assigned_store_name).length}</div>
                <div>⏳ <span className="font-medium">{t('waiting.for.store.response')}:</span> {orders.filter(o => o.assigned_store_name && !o.store_response_status).length}</div>
                <div>✅ <span className="font-medium">{t('available')}:</span> {orders.filter(o => o.store_response_status === 'available' || o.store_response_status === 'accepted').length}</div>
                <div>❌ <span className="font-medium">{t('unavailable')}:</span> {orders.filter(o => o.store_response_status === 'unavailable' || o.store_response_status === 'rejected').length}</div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <ThemeToggle />
              <LanguageToggle />
            </div>

            <Button
              onClick={() => {
                console.log("���� تحديث يدوي للطلبات...");
                fetchOrders();
              }}
              variant="outline"
              className="gap-2"
              disabled={isOrdersLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isOrdersLoading ? 'animate-spin' : ''}`} />
              {isOrdersLoading ? t('loading') : t('admin.refresh')}
            </Button>

            <Button onClick={handleLogout} variant="outline" className="gap-2">
              <LogOut className="w-4 h-4" />
              {t('admin.logout')}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Package className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-muted-foreground">
{t('admin.orders.total')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Clock className="w-8 h-8 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-muted-foreground">
                    {t('admin.orders.pending')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Package className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.assigned}</p>
                  <p className="text-muted-foreground">{t('assigned')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.delivered}</p>
                  <p className="text-muted-foreground">{t('delivered')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <XCircle className="w-8 h-8 text-red-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.returned}</p>
                  <p className="text-muted-foreground">{t('returned')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Debug Tools - أدوات التطوير والاختبار */}
        <div className="space-y-4">

          <EdgeFunctionFilter />


        </div>

        {/* Order Status Dashboard */}
        <OrderStatusDashboard
          orders={orders}
          onRefreshOrders={fetchOrders}
          totalOrdersCount={orders.length}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Settings & Create Store */}
          <div className="space-y-6">
            {/* Create Store */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  إنشاء متجر جديد
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateStore} className="space-y-4">
                  <div>
                    <Label htmlFor="storeName">اسم المتجر</Label>
                    <Input
                      id="storeName"
                      value={newStoreName}
                      onChange={(e) => setNewStoreName(e.target.value)}
                      placeholder="أدخل اسم المتجر"
                      className="text-right"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="storePassword"
                      className="flex items-center gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      كلمة المرور
                    </Label>
                    <Input
                      id="storePassword"
                      type="password"
                      value={newStorePassword}
                      onChange={(e) => setNewStorePassword(e.target.value)}
                      placeholder="أدخل كلمة المرور"
                      className="text-right"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isCreatingStore || !newStoreName.trim() || !newStorePassword.trim()}
                  >
                    {isCreatingStore ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        جاري إنشاء المتجر...
                      </>
                    ) : (
                      'إنشاء المتجر'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Orders List with Tabs */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t('admin.orders.list')}</CardTitle>
              <CardDescription>
                {t('admin.orders.all.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="pending" className="w-full">
                <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
                  <TabsTrigger value="pending">
                    {t('pending')} ({stats.pending})
                  </TabsTrigger>
                  <TabsTrigger value="assigned">
                    {t('assigned')} ({stats.assigned})
                  </TabsTrigger>
                  <TabsTrigger value="delivered">
                    {t('delivered')} ({stats.delivered})
                  </TabsTrigger>
                  <TabsTrigger value="returned">
                    {t('returned')} ({stats.returned})
                  </TabsTrigger>
                  <TabsTrigger value="rejected" className="text-red-600">
                    {t('rejected')}
                  </TabsTrigger>
                </TabsList>

                <TabsContent
                  value="pending"
                  className="space-y-4 max-h-96 overflow-y-auto"
                >
                  {/* رأس قسم الطلبات المعلقة مع أزرار التحويل */}
                  {getOrdersByStatus("pending").length > 0 && (
                    <div className="hidden">
                      <div className="flex-1">
                        <h4 className="font-semibold text-yellow-800 text-sm">
                          <ArabicText>تحويل سريع للطلبات المعلقة</ArabicText>
                        </h4>
                        <p className="text-xs text-yellow-600">
                          <ArabicText>يمكنك تحويل جميع الطلبات المعلقة تلقائياً إلى متاجرها المناسبة</ArabicText>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleAutoAssignOrders}
                          disabled={isAutoAssigning || isEnhancedAutoAssigning || getAutoAssignableOrdersCount() === 0}
                          className="gap-2 bg-green-600 hover:bg-green-700 text-white whitespace-nowrap"
                          size="sm"
                        >
                          {(isAutoAssigning || isEnhancedAutoAssigning) ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                              <ArabicText>جاري التحويل...</ArabicText>
                            </>
                          ) : (
                            <>
                              <Target className="w-4 h-4" />
                              <ArabicText>تحويل تلقائي ({getAutoAssignableOrdersCount()})</ArabicText>
                            </>
                          )}
                        </Button>

                        {getAutoAssignableOrdersCount() < getOrdersByStatus("pending").length && (
                          <div className="text-xs text-orange-600 self-center">
                            <ArabicText>
                              {getOrdersByStatus("pending").length - getAutoAssignableOrdersCount()} طل���� يحتاج تعي��ن يدوي
                            </ArabicText>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {isOrdersLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                      جاري تحميل الطلبات...
                    </div>
                  ) : (
                    <>
                      {getOrdersByStatus("pending").map(renderOrderCard)}
                      {getOrdersByStatus("pending").length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          {t('no.orders.pending')}
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent
                  value="assigned"
                  className="space-y-4 max-h-96 overflow-y-auto"
                >
                  {isOrdersLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                      {t('loading')}
                    </div>
                  ) : (
                    <>
                      {getOrdersByStatus("assigned").map(renderOrderCard)}
                      {getOrdersByStatus("assigned").length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          {t('no.orders.assigned')}
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent
                  value="delivered"
                  className="space-y-4 max-h-96 overflow-y-auto"
                >
                  {isOrdersLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                      جاري تحميل الطلبات...
                    </div>
                  ) : (
                    <>
                      {getOrdersByStatus("delivered").map(renderOrderCard)}
                      {getOrdersByStatus("delivered").length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          {t('no.orders.delivered')}
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent
                  value="returned"
                  className="space-y-4 max-h-96 overflow-y-auto"
                >
                  {isOrdersLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                      {t('loading')}
                    </div>
                  ) : (
                    <>
                      {getOrdersByStatus("returned").map(renderOrderCard)}
                      {getOrdersByStatus("returned").length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          {t('no.orders.returned')}
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent
                  value="rejected"
                  className="space-y-4"
                >
                  <RejectedOrdersPanel />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Order Details Dialog */}
      <Dialog open={showOrderDetails} onOpenChange={setShowOrderDetails}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[80vh] overflow-y-auto" dir={dir}>
          <DialogHeader>
            <DialogTitle>{t('admin.order.details')}</DialogTitle>
          </DialogHeader>
          {selectedOrderId && (
            <OrderDetails
              orderId={selectedOrderId}
              stores={stores}
              onOrderUpdated={handleOrderUpdated}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
