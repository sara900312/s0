import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import OrderDetails from "@/components/OrderDetails";
import { EnhancedOrderCard } from "@/components/orders/EnhancedOrderCard";
import { OrderStatusDashboard } from "@/components/orders/OrderStatusDashboard";
import { AutoAssignButton } from "@/components/orders/AutoAssignButton";
import { EdgeFunctionFilter } from "@/components/admin/EdgeFunctionFilter";
import { RejectedOrdersManagement } from "@/components/admin/RejectedOrdersManagement";
import { StoreResponseNotification } from "@/components/admin/StoreResponseNotification";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ArabicText } from "@/components/ui/arabic-text";
import { ReturnReasonDialog } from "@/components/orders/ReturnReasonDialog";
import { handleError, logError } from "@/utils/errorHandling";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { deleteFakeOrders } from "@/utils/cleanupFakeOrders";
import {
  LogOut,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  RefreshCw,
  Zap,
  Store,
  Users,
  Settings,
  BarChart3,
  AlertTriangle,
  Plus,
  Filter,
  Search,
  Calendar,
  DollarSign,
  User,
  Phone,
  MapPin,
  MessageSquare,
  Edit,
  Trash2,
} from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { formatCurrency } from "@/utils/currency";
import { getProductNameWithPriority } from "@/utils/productNameFixer";
import { useEnhancedEdgeFunctions } from "@/hooks/useEnhancedEdgeFunctions";
import { filterOrdersByStatus, calculateOrderStats } from "@/utils/orderFilters";

type OrderWithProduct = {
  order_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_city: string;
  product_name: string;
  product_price: number;
  store_name: string;
  created_at: string;
  order_code: string;
  order_status: string;
  assigned_store_id: string;
  total_amount: number;
  order_details?: string;
  customer_notes?: string;
  main_store_name?: string;
  assigned_store_name?: string;
  store_response_status?: string;
  store_response_at?: string;
  rejection_reason?: string;
  order_items?: any[];
  items: {
    name: string;
    price: number;
    quantity: number;
    product_id: number;
  }[];
};

const AdminDashboard = () => {
  const [orders, setOrders] = useState<OrderWithProduct[]>([]);
  const [stores, setStores] = useState<Tables<"stores">[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [pendingReturnOrder, setPendingReturnOrder] = useState<{id: string, code: string} | null>(null);
  const [isCleaningFakeOrders, setIsCleaningFakeOrders] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, dir } = useLanguage();

  const {
    autoAssignOrders,
    isAutoAssigning,
    autoAssignResults,
    clearAutoAssignResults
  } = useEnhancedEdgeFunctions();

  useEffect(() => {
    console.log("🔵 AdminDashboard: Checking authentication...");
    const adminAuth = localStorage.getItem("adminAuth");

    if (!adminAuth) {
      console.log("No adminAuth found, redirecting to login...");
      navigate("/admin-login", { replace: true });
      return;
    }

    console.log("✅ Admin authenticated, loading data...");
    fetchOrders();
    fetchStores();
  }, [navigate]);

  const fetchOrders = async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      console.log('📊 جلب الطلبات للمدير...');

      // استخدام RPC function للحصول على البيانات المدمجة
      const { data, error } = await supabase.rpc("get_orders_with_products");

      if (error) {
        console.error('❌ خطأ في RPC function:', error);
        
        // Fallback: استخدام استعلام مباشر
        console.log('🔄 محاولة استعلام مباشر...');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("orders")
          .select(
            `
            id,
            customer_name,
            customer_phone,
            customer_address,
            customer_city,
            items,
            total_amount,
            customer_notes,
            order_details,
            order_code,
            order_status,
            status,
            assigned_store_id,
            main_store_name,
            assigned_store_name,
            store_response_status,
            store_response_at,
            rejection_reason,
            created_at,
            stores!assigned_store_id(name),
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
            )
          `,
          )
          .order("created_at", { ascending: false });

        if (fallbackError) {
          console.error('❌ خطأ في الاستعلام المباشر:', fallbackError);
          throw fallbackError;
        }

        console.log('✅ نجح الاستعلام المباشر');
        
        // تحويل البيانات إلى الشكل المطلوب
        const transformedData = fallbackData?.map((order) => ({
          order_id: order.id,
          customer_name: (() => {
            const name = order.customer_name?.trim();
            if (name && name !== '') {
              return name;
            }
            // إذا لم يكن هناك اسم، استخدم اسم تجريبي مبني على order_code أو id
            const orderRef = order.order_code || order.id.slice(0, 8);
            return `${t('customer')} ${orderRef}`;
          })(),
          customer_phone: order.customer_phone || "",
          customer_address: order.customer_address || "",
          customer_city: order.customer_city || "",
          product_name: (() => {
            // أولوية لـ order_items
            if (order.order_items && Array.isArray(order.order_items) && order.order_items.length > 0) {
              const productNames = order.order_items.map((item) => getProductNameWithPriority(item))
                .filter(name => name && name.trim() !== '' && name !== 'منتج غير محدد')
                .join(', ');

              if (productNames) return productNames;
            }

            // احتياطي من items
            if (order.items && Array.isArray(order.items) && order.items.length > 0) {
              const productNames = order.items.map((item) => getProductNameWithPriority(item))
                .filter(name => name && name.trim() !== '' && name !== 'منتج غير محدد')
                .join(', ');

              if (productNames) return productNames;
            }

            return `منتج طلب ${order.order_code || order.id.slice(0, 8)}`;
          })(),
          product_price:
            order.order_items && Array.isArray(order.order_items) && order.order_items.length > 0
              ? order.order_items[0]?.price || 0
              : order.items && Array.isArray(order.items) && order.items.length > 0
              ? order.items[0]?.price || 0
              : 0,
          store_name: order.stores?.name || order.assigned_store_name || order.main_store_name || "غير معين",
          created_at: order.created_at,
          order_code: order.order_code || "",
          order_status: order.order_status || order.status || "pending",
          assigned_store_id: order.assigned_store_id || "",
          total_amount: order.total_amount || 0,
          order_details: order.order_details || "",
          customer_notes: order.customer_notes || "",
          main_store_name: order.main_store_name || "",
          assigned_store_name: order.assigned_store_name || order.stores?.name || "",
          store_response_status: order.store_response_status,
          store_response_at: order.store_response_at,
          rejection_reason: order.rejection_reason,
          order_items: order.order_items || [],
          items:
            order.order_items && Array.isArray(order.order_items)
              ? order.order_items.map((item: any) => ({
                  name: getProductNameWithPriority(item),
                  product_name: getProductNameWithPriority(item),
                  price: item.price || 0,
                  quantity: item.quantity || 1,
                  discounted_price: item.discounted_price || 0,
                  product_id: item.product_id || 0,
                  products: item.products || null,
                }))
              : order.items && Array.isArray(order.items)
              ? order.items.map((item: any) => ({
                  name: getProductNameWithPriority(item),
                  product_name: getProductNameWithPriority(item),
                  price: item.price || 0,
                  quantity: item.quantity || 1,
                  product_id: item.product_id || 0,
                }))
              : order.order_items && Array.isArray(order.order_items)
              ? order.order_items.map((item: any) => ({
                  name: item.product_name || "",
                  price: item.price || 0,
                  quantity: item.quantity || 1,
                  product_id: item.product_id || 0,
                }))
              : [],
        })) || [];

        setOrders(transformedData);
      } else {
        console.log('✅ نجح RPC function');
        
        // تحويل البيانات من RPC إلى الشكل المطلوب
        const transformedData: OrderWithProduct[] =
          data?.map((order) => ({
            order_id: order.order_id,
            customer_name: (() => {
              const name = order.customer_name?.trim();
              if (name && name !== '') {
                return name;
              }
              // إذا لم يكن هناك اسم، استخدم اسم تجريبي مبني على order_code
              const orderRef = order.order_code || order.order_id.slice(0, 8);
              return `${t('customer')} ${orderRef}`;
            })(),
            customer_phone: order.customer_phone || "",
            customer_address: order.customer_address || "",
            customer_city: order.customer_city || "",
            product_name: order.product_name || `منتج طلب ${order.order_code || order.order_id.slice(0, 8)}`,
            product_price: order.product_price || 0,
            store_name: order.store_name || "غير معين",
            created_at: order.created_at,
            order_code: order.order_code || "",
            order_status: order.order_status || "pending",
            assigned_store_id: order.assigned_store_id || "",
            total_amount: order.total_amount || 0,
            order_details: order.order_details || "",
            customer_notes: "",
            main_store_name: "",
            assigned_store_name: order.store_name || "",
            store_response_status: undefined,
            store_response_at: undefined,
            rejection_reason: undefined,
            order_items: [],
            items: [
              {
                name: order.product_name || `منتج طلب ${order.order_code}`,
                price: order.product_price || 0,
                quantity: 1,
                product_id: 1,
              },
            ],
          })) || [];

        setOrders(transformedData);
      }
    } catch (error) {
      console.error('❌ خطأ في تحميل الطلبات:', {
        error,
        message: error?.message || error,
        stack: error?.stack,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        timestamp: new Date().toISOString()
      });

      const formattedError = handleError(
        'تحميل الطلبات',
        error,
        toast
      );
      setError(formattedError.message);
      setOrders([]);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  };

  const fetchStores = async () => {
    try {
      console.log('🏪 جلب المتاجر...');
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .order("name");

      if (error) {
        console.error('❌ خطأ في جلب المتاجر:', error);
        throw error;
      }

      console.log('✅ تم جلب المتاجر بنجاح:', data?.length || 0);
      setStores(data || []);
    } catch (error) {
      console.error('❌ خطأ في تحميل المتاجر:', error);
      handleError('تحميل المتاجر', error, toast);
    }
  };

  const handleAssignOrder = async (orderId: string, storeId: string) => {
    try {
      console.log('🔄 بدء تعيين الطلب:', { orderId, storeId });

      const { data, error } = await supabase
        .from("orders")
        .update({
          assigned_store_id: storeId,
          order_status: "assigned",
          status: "assigned",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .select();

      if (error) {
        console.error('❌ خطأ في تعيين الطلب:', error);
        throw error;
      }

      console.log('✅ تم تعيين الطلب بنجاح:', data);

      toast({
        title: "تم تعيين الطلب",
        description: "تم تعيين الطلب للمتجر بنجاح",
      });

      fetchOrders(false);
    } catch (error) {
      console.error('❌ خطأ في تعيين الطلب:', error);
      handleError('تعيين الطلب', error, toast, { orderId, storeId });
    }
  };

  const handleAutoAssign = async (order: OrderWithProduct) => {
    const matchingStore = stores.find(store => 
      store.name.toLowerCase().trim() === order.main_store_name?.toLowerCase().trim()
    );

    if (!matchingStore) {
      toast({
        title: "لا يوجد متجر مطابق",
        description: `لم يتم العثور على متجر يطابق "${order.main_store_name}"`,
        variant: "destructive",
      });
      return;
    }

    await handleAssignOrder(order.order_id, matchingStore.id);
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    // البحث عن الطلب الحالي للتحقق من حالته
    const currentOrder = orders.find(order => order.order_id === orderId);
    if (!currentOrder) {
      toast({
        title: "خطأ",
        description: "لم يتم العثور على الطلب",
        variant: "destructive",
      });
      return;
    }

    // منع تغيير حالة الطلب إذا كان "مسلمة" أو "مرتجعة"
    if (currentOrder.order_status === 'delivered') {
      toast({
        title: "غير مسموح",
        description: "لا يمكن تغيير حالة الطلب بعد تسليمه",
        variant: "destructive",
      });
      return;
    }

    if (currentOrder.order_status === 'returned') {
      toast({
        title: "غير مسموح",
        description: "لا يمكن تغيير حالة الطلب المرتجع",
        variant: "destructive",
      });
      return;
    }

    // إذا كان المستخدم يريد تحويل الطلب إلى "مرتجعة"، اطلب سبب الإرجاع
    if (newStatus === 'returned') {
      setPendingReturnOrder({
        id: orderId,
        code: currentOrder.order_code || orderId
      });
      setShowReturnDialog(true);
      return;
    }

    // التحديث العادي للحالات الأخرى
    await updateOrderStatus(orderId, newStatus);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string, returnReason?: string) => {
    try {
      console.log('🔄 بدء تحديث حالة الطلب:', {
        orderId,
        newStatus,
        returnReason,
        timestamp: new Date().toISOString()
      });

      const updateData: any = {
        order_status: newStatus,
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      // إضافة سبب الإرجاع في order_details إذا كان متوفراً
      if (returnReason && newStatus === 'returned') {
        updateData.order_details = `Return reason: ${returnReason}`;
        console.log('📝 إضافة سبب الإرجاع:', { returnReason, order_details: updateData.order_details });
      }

      console.log('📤 إرسال التحديث إلى قاعدة البيانات:', updateData);

      const { data, error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", orderId)
        .select();

      if (error) {
        console.error('❌ خطأ في تحديث قاعدة البيانات:', {
          error,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          orderId,
          updateData
        });
        throw error;
      }

      console.log('✅ تم تحديث الطلب بنجاح:', { data, orderId, newStatus });

      const statusMessages = {
        delivered: "تم تسليم الطلب بنجاح",
        returned: "تم إرجاع الطلب بنجاح",
        assigned: "تم تحديث حالة الطلب"
      };

      toast({
        title: "تم التحديث",
        description: statusMessages[newStatus as keyof typeof statusMessages] || "تم تحديث حالة الطلب بنجاح",
      });

      fetchOrders(false);
    } catch (error) {
      console.error('❌ خطأ في تحديث حالة الطلب:', {
        error,
        message: error?.message || error,
        stack: error?.stack,
        orderId,
        newStatus,
        returnReason,
        timestamp: new Date().toISOString()
      });

      handleError(
        'تحديث حالة الطلب',
        error,
        toast,
        { orderId, newStatus, returnReason }
      );
    }
  };

  const handleReturnConfirm = async (reason: string) => {
    if (pendingReturnOrder) {
      console.log('🔄 تأكيد إرجاع الطلب:', {
        orderId: pendingReturnOrder.id,
        orderCode: pendingReturnOrder.code,
        reason,
        timestamp: new Date().toISOString()
      });

      try {
        await updateOrderStatus(pendingReturnOrder.id, 'returned', reason);
        setPendingReturnOrder(null);
        setShowReturnDialog(false);
        console.log('✅ تم إرجاع الطلب بنجاح');
      } catch (error) {
        console.error('❌ خطأ في إرجاع الطلب:', error instanceof Error ? error.message : error);
        // لا نحتاج لعرض toast هنا لأن updateOrderStatus سيتولى ذلك
      }
    }
  };

  const handleReturnCancel = () => {
    setPendingReturnOrder(null);
    setShowReturnDialog(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("adminAuth");
    navigate("/admin-login");
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
    fetchOrders(false);
  };

  const handleRefreshOrders = () => {
    fetchOrders(false);
  };

  const handleAutoAssignAll = async () => {
    try {
      const results = await autoAssignOrders({
        showDetailedResults: true,
        onProgress: (response) => {
          console.log('📊 Auto-assign progress:', response);
        }
      });
      
      if (results) {
        fetchOrders(false);
      }
    } catch (error) {
      console.error('❌ Error in auto-assign all:', error);
    }
  };

  const handleCleanupFakeOrders = async () => {
    setIsCleaningFakeOrders(true);
    
    try {
      console.log('🗑️ بدء حذف الطلبات المزيفة...');
      
      const result = await deleteFakeOrders();
      
      if (result.success) {
        toast({
          title: "تم الحذف بنجاح",
          description: result.message || "تم حذف الطلبات المزيفة",
        });
        
        // إعادة تحميل الطلبات
        fetchOrders(false);
      } else {
        toast({
          title: "فشل في الحذف",
          description: result.error || "حدث خطأ أثناء حذف الطلبات",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ خطأ في حذف الطلبات المزيفة:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ غير متوقع أثناء حذف الطلبات",
        variant: "destructive",
      });
    } finally {
      setIsCleaningFakeOrders(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      pending: {
        label: "معلقة",
        message: "⏳ في الانتظار: لم يتم تعيين هذا الطلب لأي متجر بعد.",
        variant: "secondary" as const,
        icon: Clock,
      },
      assigned: {
        label: t('assigned'),
        message: `📦 ${t('order')} ${t('assigned')} إلى المتجر، جاري المعالجة.`,
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

  const getStatusStats = () => {
    return calculateOrderStats(orders);
  };

  const getOrdersByStatus = (status: string) => {
    return filterOrdersByStatus(orders, status as any);
  };

  const renderOrderCard = (order: OrderWithProduct) => {
    const statusInfo = getStatusBadge(order.order_status || "pending");
    const StatusIcon = statusInfo.icon;

    return (
      <div
        key={order.order_id}
        className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
      >
        <div className="flex flex-col space-y-3">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <StatusIcon className="w-5 h-5 text-muted-foreground" />
              <div className="flex flex-col">
                <h3 className="font-bold text-lg">
                  <ArabicText>
                    طلب #{order.order_code || order.order_id.slice(0, 8)}
                  </ArabicText>
                </h3>
                <p className="text-sm text-muted-foreground">
                  <ArabicText>{order.customer_name}</ArabicText>
                </p>
              </div>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleViewOrder(order.order_id)}
                className="flex items-center gap-1"
              >
                <Eye className="w-4 h-4" />
                {t('details')}
              </Button>
              <Select
                value={order.order_status || "pending"}
                onValueChange={(newStatus) =>
                  handleStatusUpdate(order.order_id, newStatus)
                }
                disabled={order.order_status === 'delivered' || order.order_status === 'returned'}
              >
                <SelectTrigger className={`w-40 ${
                  order.order_status === 'delivered' || order.order_status === 'returned'
                    ? 'opacity-60 cursor-not-allowed'
                    : ''
                }`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">معلقة</SelectItem>
                  <SelectItem value="assigned">{t('assigned')}</SelectItem>
                  <SelectItem value="delivered">{t('delivered')}</SelectItem>
                  <SelectItem value="returned">{t('returned')}</SelectItem>
                </SelectContent>
              </Select>
              {(order.order_status === 'delivered' || order.order_status === 'returned') && (
                <span className="text-xs text-muted-foreground">
                  (لا يمكن التغيير)
                </span>
              )}
            </div>
          </div>

          {/* Order Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{t('customer.label')}</span>
                <ArabicText className="text-foreground">{order.customer_name}</ArabicText>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">الهاتف:</span>
                <span className="font-mono">{order.customer_phone}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                <span className="font-medium">العنوان:</span>
                <ArabicText className="text-foreground">{order.customer_address}</ArabicText>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">المبلغ:</span>
                <span className="font-bold text-primary">
                  {formatCurrency(order.total_amount)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">المتجر:</span>
                <span className="text-blue-600 font-medium">
                  {order.assigned_store_name || order.store_name || "غير معين"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">التاريخ:</span>
                <span>
                  {new Date(order.created_at).toLocaleDateString('ar-IQ', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Store Response Status */}
          {order.assigned_store_name && order.store_response_status && (
            <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
              <CheckCircle className={`w-4 h-4 ${
                order.store_response_status === 'available' || order.store_response_status === 'accepted'
                  ? 'text-green-600'
                  : order.store_response_status === 'unavailable' || order.store_response_status === 'rejected'
                  ? 'text-red-600'
                  : 'text-yellow-600'
              }`} />
              <span className="text-sm font-medium">حالة التوفر:</span>
              <span className={`text-sm font-bold ${
                order.store_response_status === 'available' || order.store_response_status === 'accepted'
                  ? 'text-green-600'
                  : order.store_response_status === 'unavailable' || order.store_response_status === 'rejected'
                  ? 'text-red-600'
                  : 'text-yellow-600'
              }`}>
                {order.store_response_status === 'available' || order.store_response_status === 'accepted'
                  ? '✅ متوفر'
                  : order.store_response_status === 'unavailable' || order.store_response_status === 'rejected'
                  ? '❌ غير متوفر'
                  : '⏳ في انتظار رد المتجر'
                }
              </span>
            </div>
          )}

          {/* Customer Notes */}
          {order.customer_notes && (
            <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
              <MessageSquare className="w-4 h-4 text-muted-foreground mt-1" />
              <div className="flex-1">
                <span className="text-sm font-medium text-muted-foreground">ملاحظات العميل:</span>
                <div className="mt-1">
                  <ArabicText className="text-sm">{order.customer_notes}</ArabicText>
                </div>
              </div>
            </div>
          )}

          {/* Return Reason for Returned Orders */}
          {order.order_details && order.order_status === 'returned' && order.order_details.includes('Return reason:') && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <MessageSquare className="w-4 h-4 text-red-600 mt-1" />
              <div className="flex-1">
                <span className="text-sm font-semibold text-red-600">🔄 سبب الإرجاع:</span>
                <div className="mt-1">
                  <ArabicText className="text-sm font-medium text-red-700">
                    {order.order_details.replace('Return reason: ', '')}
                  </ArabicText>
                </div>
              </div>
            </div>
          )}

          {/* Auto-assign button for pending orders */}
          {order.order_status === 'pending' && order.main_store_name && (
            <AutoAssignButton
              order={order}
              stores={stores}
              onAutoAssign={handleAutoAssign}
              isAssigning={false}
            />
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-lg">
          <Loader2 className="w-6 h-6 animate-spin" />
          جاري التحميل...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-destructive mb-4">{error}</div>
          <Button onClick={() => fetchOrders()}>المحاولة مرة أخرى</Button>
        </div>
      </div>
    );
  }

  const stats = getStatusStats();

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 p-6"
      dir={dir}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-primary">
              {t('admin.dashboard')}
            </h1>
            <p className="text-muted-foreground">
              {t('admin.orders.all.description')}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <ThemeToggle />
              <LanguageToggle />
            </div>

            <Button
              onClick={handleRefreshOrders}
              variant="outline"
              disabled={isRefreshing}
              className="gap-2"
            >
              {isRefreshing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  {t('loading')}
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  {t('admin.refresh')}
                </>
              )}
            </Button>

            <Button
              onClick={handleAutoAssignAll}
              disabled={isAutoAssigning}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {isAutoAssigning ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  جاري التعيين...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  تعيين تلقائي
                </>
              )}
            </Button>

            <Button
              onClick={handleCleanupFakeOrders}
              disabled={isCleaningFakeOrders}
              variant="outline"
              className="gap-2 text-red-600 border-red-300 hover:bg-red-50"
            >
              {isCleaningFakeOrders ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  جاري الحذف...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  حذف الطلبات المزيفة
                </>
              )}
            </Button>

            <Button onClick={handleLogout} variant="outline" className="gap-2">
              <LogOut className="w-4 h-4" />
              {t('admin.logout')}
            </Button>
          </div>
        </div>

        {/* Edge Functions Status */}
        <div className="mb-6">
          <EdgeFunctionFilter />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Package className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-muted-foreground">{t('admin.orders.total')}</p>
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
                  <p className="text-muted-foreground">{t('admin.orders.pending')}</p>
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
                  <p className="text-muted-foreground">طلبات معينة</p>
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
                  <p className="text-muted-foreground">{t('admin.orders.completed')}</p>
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
                  <p className="text-muted-foreground">طلبات مرتجعة</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Status Dashboard */}
        <div className="mb-8">
          <OrderStatusDashboard
            orders={orders}
            onRefreshOrders={handleRefreshOrders}
            totalOrdersCount={stats.total}
          />
        </div>

        {/* Rejected Orders Management */}
        <div className="mb-8">
          <RejectedOrdersManagement onOrderReassigned={handleOrderUpdated} />
        </div>

        {/* Orders List with Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.orders.list')}</CardTitle>
            <CardDescription>
              {t('admin.orders.all.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="pending">
                  ⏳ معلقة ({stats.pending})
                </TabsTrigger>
                <TabsTrigger value="assigned">
                  📦 معينة ({stats.assigned})
                </TabsTrigger>
                <TabsTrigger value="delivered">
                  ✅ مسلمة ({stats.delivered})
                </TabsTrigger>
                <TabsTrigger value="returned">
                  🔁 مرتجعة ({stats.returned})
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="pending"
                className="space-y-4 max-h-96 overflow-y-auto"
              >
                {getOrdersByStatus("pending").map((order) =>
                  renderOrderCard(order),
                )}
                {getOrdersByStatus("pending").length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('no.orders.pending')}
                  </div>
                )}
              </TabsContent>

              <TabsContent
                value="assigned"
                className="space-y-4 max-h-96 overflow-y-auto"
              >
                {getOrdersByStatus("assigned").map((order) =>
                  renderOrderCard(order),
                )}
                {getOrdersByStatus("assigned").length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('no.orders.assigned')}
                  </div>
                )}
              </TabsContent>

              <TabsContent
                value="delivered"
                className="space-y-4 max-h-96 overflow-y-auto"
              >
                {getOrdersByStatus("delivered").map((order) =>
                  renderOrderCard(order),
                )}
                {getOrdersByStatus("delivered").length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('no.orders.delivered')}
                  </div>
                )}
              </TabsContent>

              <TabsContent
                value="returned"
                className="space-y-4 max-h-96 overflow-y-auto"
              >
                {getOrdersByStatus("returned").map((order) =>
                  renderOrderCard(order),
                )}
                {getOrdersByStatus("returned").length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    لا توجد طلبات مرتجعة
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Order Details Dialog */}
      <Dialog open={showOrderDetails} onOpenChange={setShowOrderDetails}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[80vh] overflow-y-auto" dir={dir}>
          <DialogHeader>
            <DialogTitle>{t('admin.order.details')}</DialogTitle>
          </DialogHeader>
          {selectedOrderId && (
            <ErrorBoundary>
              <OrderDetails
                orderId={selectedOrderId}
                stores={stores}
                onOrderUpdated={handleOrderUpdated}
              />
            </ErrorBoundary>
          )}
        </DialogContent>
      </Dialog>

      <ReturnReasonDialog
        isOpen={showReturnDialog}
        onClose={handleReturnCancel}
        onConfirm={handleReturnConfirm}
        orderCode={pendingReturnOrder?.code}
      />

      {/* Store Response Notifications */}
      <StoreResponseNotification />
    </div>
  );
};

export default AdminDashboard;