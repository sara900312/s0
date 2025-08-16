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
import { OrderItems } from "@/components/orders/OrderItems";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ArabicText } from "@/components/ui/arabic-text";
import { ReturnReasonDialog } from "@/components/orders/ReturnReasonDialog";
import { handleError, logError } from "@/utils/errorHandling";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  LogOut,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  RefreshCw,
} from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { formatCurrency } from "@/utils/currency";
import { getProductNameWithPriority } from "@/utils/productNameFixer";
import { StoreProductAvailabilityCheck } from "@/components/stores/StoreProductAvailabilityCheck";
import { CustomerDeliveryDetails } from "@/components/stores/CustomerDeliveryDetails";
import { submitStoreResponse } from "@/services/storeResponseService";
import { submitTempStoreResponse } from "@/services/temporaryStoreResponseService";

type OrderWithProduct = {
  order_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_city: string;
  product_name: string;
  product_price: number;
  assigned_store_name: string;
  created_at: string;
  order_code: string;
  order_status: string;
  assigned_store_id: string;
  total_amount: number;
  subtotal: number;
  customer_notes: string;
  order_details?: string;
  store_response_status?: string;
  store_response_at?: string;
  order_items?: any[];
  items: {
    name: string;
    price: number;
    quantity: number;
    product_id: number;
  }[];
};

const StoreDashboard = () => {
  const [orders, setOrders] = useState<OrderWithProduct[]>([]);
  const [storeInfo, setStoreInfo] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [pendingReturnOrder, setPendingReturnOrder] = useState<{id: string, code: string} | null>(null);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [customerDetailsOrderId, setCustomerDetailsOrderId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, dir } = useLanguage();

  useEffect(() => {
    console.log("🔵 StoreDashboard: Checking authentication...");
    const storeAuth = localStorage.getItem("storeAuth");

    if (!storeAuth) {
      console.log("No storeAuth found, redirecting to login...");
      navigate("/store-login-space9003", { replace: true });
      return;
    }

    try {
      const store = JSON.parse(storeAuth);
      console.log("✅ Store authenticated:", store);
      setStoreInfo(store);
      fetchOrders(store.id);
    } catch (error) {
      logError('تحليل ��يانات تسجيل الدخول', error, { storeAuth });
      localStorage.removeItem("storeAuth");
      navigate("/store-login-space9003", { replace: true });
    }
  }, [navigate]);

  const fetchOrders = async (storeId: string, showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      console.log('📊 جلب طلبات المتجر:', storeId);

      // Query orders directly from the orders table with proper filtering
      // إخ��اء الطلبات التي تم رفضها (غير متوفرة)
      const { data, error } = await supabase
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
          subtotal,
          customer_notes,
          order_details,
          order_code,
          order_status,
          status,
          assigned_store_id,
          store_response_status,
          store_response_at,
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
        .eq("assigned_store_id", storeId)
        .in("order_status", ["assigned", "delivered", "returned"]) // جميع حالات الطلبات
        .or("store_response_status.is.null,store_response_status.neq.unavailable") // إظهار الطلبات الجديدة أو غير المرفوضة
        .order("created_at", { ascending: false });

      if (error) {
        console.error('❌ خطأ في استعلام Supabase:', error);
        throw error;
      }

      console.log('✅ تم جلب الطلبات بنجاح:', {
        storeId,
        totalOrders: data?.length || 0,
        ordersByStatus: {
          assigned: data?.filter(o => o.order_status === 'assigned').length || 0,
          delivered: data?.filter(o => o.order_status === 'delivered').length || 0,
          returned: data?.filter(o => o.order_status === 'returned').length || 0
        }
      });

      // تتبع الطل��ات بدون أسماء عملاء صالحة
      const ordersWithoutValidCustomerNames = data?.filter(o =>
        !o.customer_name || o.customer_name.trim() === ''
      );

      if (ordersWithoutValidCustomerNames && ordersWithoutValidCustomerNames.length > 0) {
        console.log(`🔧 إصلاح ${ordersWithoutValidCustomerNames.length} طلب ب����ون أسماء عملاء`);

        // محاولة إصلاح البيانات بإضافة أسماء تجريبية
        for (const order of ordersWithoutValidCustomerNames) {
          try {
            const tempName = `${t('customer')} ${order.order_code || order.id.slice(0, 8)}`;

            const { error: updateError } = await supabase
              .from('orders')
              .update({ customer_name: tempName })
              .eq('id', order.id);

            if (updateError) {
              console.error('❌ فشل في تحديث اسم العميل:', updateError);
            }
          } catch (error) {
            console.error('حدث خطأ في إصلاح اسم العميل:', error);
          }
        }
      }

      // تتبع إضافي للطلبات التي لا تحتوي على أسماء منتجات صالحة
      const ordersWithoutValidProducts = data?.filter(o => {
        const hasValidOrderItems = o.order_items && o.order_items.some(item =>
          item.product_name && item.product_name.trim() !== '' && item.product_name !== 'م��تج غير محدد'
        );
        const hasValidItems = Array.isArray(o.items) && o.items.some(item =>
          item.name && item.name.trim() !== '' && item.name !== 'منتج غير محدد'
        );
        return !hasValidOrderItems && !hasValidItems;
      });

      if (ordersWithoutValidProducts && ordersWithoutValidProducts.length > 0) {
        console.warn('⚠️ Orders without valid product names:', ordersWithoutValidProducts);
      }

      // تحويل البيانات إلى الشكل المطلوب

      // Transform the data to match the expected format
      const transformedOrders: OrderWithProduct[] =
        data?.map((order) => ({
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
            // استخدام نفس منطق لوحة المدير: order_items أولاً، ثم items كاحتياط
            if (order.order_items && Array.isArray(order.order_items) && order.order_items.length > 0) {
              const productNames = order.order_items.map((item) => getProductNameWithPriority(item))
                .filter(name => name && name.trim() !== '' && name !== 'منتج غير محدد');

              if (productNames.length > 0) {
                return productNames.join(', ');
              }
            }

            // اح��ياطي: استخدام items إذا لم تنجح order_items
            if (order.items && Array.isArray(order.items) && order.items.length > 0) {
              const productNames = order.items.map((item) => getProductNameWithPriority(item))
                .filter(name => name && name.trim() !== '' && name !== 'منتج غير محدد');

              if (productNames.length > 0) {
                return productNames.join(', ');
              }
            }

            return `منتج طلب ${order.order_code || order.id.slice(0, 8)}`;
          })(),
          product_price:
            order.order_items && Array.isArray(order.order_items) && order.order_items.length > 0
              ? order.order_items[0]?.price || 0
              : order.items && Array.isArray(order.items) && order.items.length > 0
              ? order.items[0]?.price || 0
              : 0,
          assigned_store_name: order.stores?.name || "غير معين",
          created_at: order.created_at,
          order_code: order.order_code || "",
          order_status: order.order_status || order.status || "pending",
          assigned_store_id: order.assigned_store_id || "",
          total_amount: order.total_amount || 0,
          subtotal: order.subtotal || 0,
          customer_notes: order.customer_notes || "",
          order_details: order.order_details || "",
          store_response_status: order.store_response_status,
          store_response_at: order.store_response_at,
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

      setOrders(transformedOrders);
    } catch (error) {
      console.error('❌ خطأ في تحميل الطلبات:', {
        error,
        message: error?.message || error,
        stack: error?.stack,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        storeId,
        timestamp: new Date().toISOString()
      });

      const formattedError = handleError(
        'تحميل الطلبات',
        error,
        toast,
        { storeId }
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

    // إذا كان المستخدم يريد تحويل الطلب إلى "مرتجعة"، اط��ب سبب الإرجاع
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
        storeId: storeInfo?.id,
        timestamp: new Date().toISOString()
      });

      const updateData: any = {
        order_status: newStatus,
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      // إضاف�� سبب الإرجاع في order_details إذا كان متوفراً
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
        console.error('❌ خطأ ف�� تحديث قاعدة البيانات:', {
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

      fetchOrders(storeInfo!.id, false);
    } catch (error) {
      console.error('❌ خطأ في تحديث حالة الطلب:', {
        error,
        message: error?.message || error,
        stack: error?.stack,
        orderId,
        newStatus,
        returnReason,
        storeId: storeInfo?.id,
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
    localStorage.removeItem("storeAuth");
    navigate("/store-login-space9003");
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
    if (storeInfo?.id) {
      fetchOrders(storeInfo.id, false);
    }
  };

  const handleRefreshOrders = () => {
    if (storeInfo?.id) {
      fetchOrders(storeInfo.id, false);
    }
  };

  // معالج استجابة المتجر بالموافقة (المنتج متوفر)
  const handleStoreAvailableResponse = async (orderId: string) => {
    try {
      console.log('🟢 تأكيد توفر المنتج - تحديث البيانات:', { orderId, storeId: storeInfo?.id });

      // تحديث قائمة الطلبات لإظهار التغيير
      if (storeInfo?.id) {
        await fetchOrders(storeInfo.id, false);
      }

    } catch (error) {
      console.error('�� خطأ في callback توفر المنتج:', error instanceof Error ? error.message : error);
    }
  };

  // معالج استجابة المتجر بالرفض (المنتج غير متوفر)
  const handleStoreUnavailableResponse = async (orderId: string) => {
    try {
      console.log('🔴 رفض الطلب - تحديث البيانات:', { orderId, storeId: storeInfo?.id });

      // تحديث قائم�� الطلبات لإظهار ا��تغيير
      if (storeInfo?.id) {
        await fetchOrders(storeInfo.id, false);
      }

      // إغلاق Dialog إذا كان مفتوحاً
      setShowOrderDetails(false);

    } catch (error) {
      console.error('❌ خطأ في callback رفض الطلب:', error instanceof Error ? error.message : error);
    }
  };

  // معالج تأكيد التسليم
  const handleDeliveryConfirm = async (orderId: string) => {
    try {
      console.log('🚚 تأكيد جاهزية الطلب للتسليم:', { orderId, storeId: storeInfo?.id });

      setCustomerDetailsOrderId(orderId);
      setShowCustomerDetails(true);
      setShowOrderDetails(false); // إغلاق dialog تفاصيل الطلب

      toast({
        title: "جاهز للتسليم",
        description: "تم تأكيد جاهزية الطلب للتسلي��. تفاصيل العميل متاحة الآن.",
      });

    } catch (error) {
      console.error('❌ خطأ في تأكيد التسليم:', error instanceof Error ? error.message : error);
      handleError('تأكيد التسليم', error, toast, { orderId });
    }
  };

  // معالج إكمال التسليم
  const handleDeliveryComplete = async (orderId: string) => {
    try {
      console.log('✅ إكمال تسليم ��لطلب:', { orderId, storeId: storeInfo?.id });

      setShowCustomerDetails(false);
      setCustomerDetailsOrderId(null);

      // تحديث قائمة الطلب��ت
      if (storeInfo?.id) {
        fetchOrders(storeInfo.id, false);
      }

      toast({
        title: "تم التسليم بنجاح ✅",
        description: "تم تأكيد تسليم الطلب للعميل بنجاح",
      });

    } catch (error) {
      console.error('❌ خطأ في إكمال التسليم:', error instanceof Error ? error.message : error);
      handleError('إكمال التسليم', error, toast, { orderId });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      pending: {
        label: "معلقة",
        message: "⏳ في الانتظار: لم يتم تعيين هذا الطلب لأي م��جر بعد.",
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
        message: `✅ تم تسليم ${t('order')} بنجا��.`,
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
    const assignedOrders = orders.filter((order) => order.order_status === "assigned");
    const stats = {
      total: orders.length,
      assigned: assignedOrders.length,
      delivered: orders.filter((order) => order.order_status === "delivered")
        .length,
      returned: orders.filter((order) => order.order_status === "returned")
        .length,
    };

    // تم حساب الإحصائيات بنجاح

    return stats;
  };

  const getOrdersByStatus = (status: string) => {
    return orders.filter((order) => order.order_status === status);
  };

  // دالة محسّنة لعرض اسم المنتج مع إصلاح الأسماء الفارغة أو المولدة تلقائياً
  // (نفس منطق AdminDashboard)
  function getProductName(item: any) {
    return getProductNameWithPriority(item);
  }

  const renderOrderCard = (order: OrderWithProduct) => {
    const statusInfo = getStatusBadge(order.order_status || "assigned");
    const StatusIcon = statusInfo.icon;


    return (
      <div
        key={order.order_id}
        className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
      >
        <div className="flex flex-col space-y-3">
          {/* Header - Product name only */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <StatusIcon className="w-5 h-5 text-muted-foreground" />
              <div className="flex flex-col">
                <h3 className="font-bold text-lg text-blue-800">
                  {(() => {
                    const name = order.customer_name?.trim();
                    if (name && name !== '') {
                      return name;
                    }
                    // استخدام كود الطلب لإنشاء اسم مؤقت
                    const orderRef = order.order_code || order.order_id.slice(0, 8);
                    return `${t('customer')} ${orderRef}`;
                  })()}
                </h3>
                <p className="text-sm text-gray-600">طلب #{order.order_code || order.order_id.slice(0, 8)}</p>
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
                value={order.order_status || "assigned"}
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
                  <SelectItem value="assigned">{t('assigned')}</SelectItem>
                  <SelectItem
                    value="delivered"
                    disabled={order.store_response_status !== 'available'}
                  >
                    {t('delivered')}
                  </SelectItem>
                  <SelectItem
                    value="returned"
                    disabled={order.store_response_status !== 'available'}
                  >
                    {t('returned')}
                  </SelectItem>
                </SelectContent>
              </Select>
              {(order.order_status === 'delivered' || order.order_status === 'returned') && (
                <span className="text-xs text-muted-foreground">
                  (لا يمكن التغيير)
                </span>
              )}
              {order.store_response_status !== 'available' &&
               order.order_status !== 'delivered' &&
               order.order_status !== 'returned' && (
                <span className="text-xs text-amber-600">
                  (أكد توفر المنتج أولاً)
                </span>
              )}
            </div>
          </div>


          {/* Enhanced Product Details */}
          <div className="space-y-3 text-sm">
            {/* Order Info */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-foreground text-[29px]">{t('quantity.label')}</span>
                <span className="font-medium mr-auto text-center w-[37.5px] text-[26px] text-foreground">
                  {(() => {
                    // حساب الكمية الإجمالية بنفس منطق الأولوية
                    if (order.order_items && Array.isArray(order.order_items) && order.order_items.length > 0) {
                      return order.order_items.reduce((total, item) => total + (item.quantity || 1), 0);
                    }
                    if (order.items && Array.isArray(order.items) && order.items.length > 0) {
                      return order.items.reduce((total, item) => total + (item.quantity || 1), 0);
                    }
                    return 1;
                  })()}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2 text-left">
                <span className="text-foreground text-[26px] leading-[40px]">{t('customer.label')}</span>
                <span className="font-medium text-[30px] mr-auto pl-4 text-foreground">
                  <h2> {(() => {
                    const name = order.customer_name?.trim();
                    if (name && name !== '') {
                      return name;
                    }
                    // استخدام كود الطلب لإنشاء اسم مؤقت
                    const orderRef = order.order_code || order.order_id.slice(0, 8);
                    return `${t('customer')} ${orderRef}`;
                  })()}</h2>
                </span>
              </div>
            </div>
          </div>


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
          <Button onClick={() => fetchOrders(storeInfo?.id || "")}>
            المحاولة مرة أخرى
          </Button>
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
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-primary">
              {t('store.name')}: {storeInfo?.name}
            </h1>
            <p className="text-muted-foreground">{t('store.dashboard')}</p>
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
                  {t('store.refresh')}
                </>
              )}
            </Button>
            <Button onClick={handleLogout} variant="outline" className="gap-2">
              <LogOut className="w-4 h-4" />
              {t('store.logout')}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Package className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-muted-foreground">{t('store.orders.total')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Clock className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.assigned}</p>
                  <p className="text-muted-foreground">{t('store.orders.assigned')}</p>
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
                  <p className="text-muted-foreground">{t('store.orders.delivered')}</p>
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
                  <p className="text-muted-foreground">{t('store.orders.returned')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Orders List with Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>{t('store.orders')}</CardTitle>
            <CardDescription>
              {t('store.orders.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="assigned" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="assigned">
                  📦 {t('store.tab.assigned')} ({stats.assigned})
                </TabsTrigger>
                <TabsTrigger value="delivered">
                  ✅ {t('delivered')} ({stats.delivered})
                </TabsTrigger>
                <TabsTrigger value="returned">
                  🔁 {t('returned')} ({stats.returned})
                </TabsTrigger>
              </TabsList>

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
                    لا ��وجد طلبات مرتجعة
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
            <DialogTitle>
              {(() => {
                if (!selectedOrderId) return t('store.order.details');
                const selectedOrder = orders.find(o => o.order_id === selectedOrderId);
                if (selectedOrder?.order_status === "assigned") {
                  if (!selectedOrder?.store_response_status) {
                    return t('store.dialog.inventory.status');
                  } else if (selectedOrder?.store_response_status === "available") {
                    return t('store.dialog.available.customer');
                  }
                }
                return t('store.order.details');
              })()}
            </DialogTitle>
          </DialogHeader>
          {selectedOrderId && (() => {
            const selectedOrder = orders.find(o => o.order_id === selectedOrderId);

            console.log('🔍 Dialog selectedOrder:', {
              selectedOrderId,
              selectedOrder: selectedOrder ? {
                id: selectedOrder.order_id,
                order_status: selectedOrder.order_status,
                store_response_status: selectedOrder.store_response_status,
                order_items: selectedOrder.order_items?.length || 0,
                order_items_data: selectedOrder.order_items,
                items: selectedOrder.items?.length || 0,
                items_data: selectedOrder.items
              } : null
            });

            // إذا كان الطلب معين، عرض مكون التحقق من المخزون
            if (selectedOrder?.order_status === "assigned") {
              return (
                <StoreProductAvailabilityCheck
                  storeId={storeInfo?.id || ""}
                  order={{
                    id: selectedOrder.order_id,
                    order_code: selectedOrder.order_code,
                    customer_name: selectedOrder.customer_name,
                    customer_phone: selectedOrder.customer_phone,
                    customer_address: selectedOrder.customer_address,
                    customer_notes: selectedOrder.customer_notes,
                    total_amount: selectedOrder.total_amount,
                    subtotal: selectedOrder.subtotal,

                    created_at: selectedOrder.created_at,
                    order_status: selectedOrder.order_status,
                    store_response_status: selectedOrder.store_response_status,
                    order_items: (() => {
                      console.log('🔧 معالجة order_items للطلب:', selectedOrder.order_id, {
                        order_items_raw: selectedOrder.order_items,
                        items_raw: selectedOrder.items,
                        order_items_count: selectedOrder.order_items?.length || 0,
                        items_count: selectedOrder.items?.length || 0
                      });

                      // تشخيص مفصل لكل منتج في order_items
                      if (selectedOrder.order_items) {
                        console.log('📋 تحليل مفصل لـ order_items:');
                        selectedOrder.order_items.forEach((item, index) => {
                          console.log(`  🔍 منتج ${index + 1}:`, {
                            id: item.id,
                            product_name: item.product_name,
                            name: item.name,
                            products: item.products,
                            products_name: item.products?.name,
                            quantity: item.quantity,
                            price: item.price
                          });
                        });
                      }

                      // التأكد من وجود أ��ماء منتجات صحيحة في order_items
                      if (selectedOrder.order_items && Array.isArray(selectedOrder.order_items) && selectedOrder.order_items.length > 0) {
                        const processedItems = selectedOrder.order_items.map((item, index) => {
                          // استخدام دالة getProductNameWithPriority الموحدة (نفس منطق AdminDashboard)
                          const productName = getProductNameWithPriority(item);

                          const processedItem = {
                            ...item,
                            product_name: productName,
                            name: productName // إضافة name كـ backup
                          };

                          console.log(`  ✅ معالج منتج ${index + 1}:`, {
                            original: {
                              product_name: item.product_name,
                              name: item.name,
                              products_name: item.products?.name
                            },
                            final: {
                              product_name: processedItem.product_name,
                              name: processedItem.name
                            }
                          });

                          return processedItem;
                        });

                        console.log('✅ تم معالجة order_items:', processedItems);
                        return processedItems;
                      }

                      // إنشاء منتج افتراضي من بيانات الطلب إذا لم تكن هناك order_items
                      if (selectedOrder.items && Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0) {
                        console.log('🔄 استخدام items كبديل عن order_items:', selectedOrder.items);

                        const processedItems = selectedOrder.items.map((item, index) => {
                          // استخدام دالة getProductNameWithPriority الموحدة
                          const productName = getProductNameWithPriority(item);

                          return {
                            id: `item-${index}`,
                            product_name: productName,
                            name: productName,
                            quantity: item.quantity || 1,
                            price: item.price || selectedOrder.total_amount || 205000,
                            discounted_price: item.price || selectedOrder.total_amount || 205000
                          };
                        });

                        console.log('✅ تم معالجة items كبديل:', processedItems);
                        return processedItems;
                      }

                      // إنشاء منتج افتراضي واحد
                      console.log('⚠️ لا توجد order_items أو items صالحة، إنشاء منتج افتراضي');

                      const orderRef = selectedOrder.order_code || selectedOrder.order_id.slice(0, 8);

                      // استخدام دالة getProductNameWithPriority للمنتج الافتراضي أيضاً
                      const productName = selectedOrder.product_name && selectedOrder.product_name.trim() !== '' && selectedOrder.product_name !== 'منتج غير محدد'
                        ? selectedOrder.product_name
                        : `منتج الطلب ${orderRef}`;

                      const defaultItem = {
                        id: `default-${selectedOrder.order_id}`,
                        product_name: productName,
                        name: productName,
                        quantity: 1,
                        price: selectedOrder.total_amount || selectedOrder.subtotal || 205000,
                        discounted_price: selectedOrder.total_amount || selectedOrder.subtotal || 205000
                      };

                      console.log('✅ تم إنشاء منتج افتراضي:', defaultItem);
                      return [defaultItem];
                    })()
                  }}
                  onAvailableResponse={handleStoreAvailableResponse}
                  onUnavailableResponse={handleStoreUnavailableResponse}
                  onDeliveryConfirm={handleDeliveryConfirm}
                  onOrderUpdated={handleOrderUpdated}
                />
              );
            }

            // في باقي الحالات، عرض التفاصيل ��لعادية
            return (
              <OrderDetails
                orderId={selectedOrderId}
                stores={[]} // Store dashboard doesn't need store assignment functionality
                onOrderUpdated={handleOrderUpdated}
                storeId={storeInfo?.id} // تمرير storeId للـ x-store-id header
              />
            );
          })()}
        </DialogContent>
      </Dialog>

      <ReturnReasonDialog
        isOpen={showReturnDialog}
        onClose={handleReturnCancel}
        onConfirm={handleReturnConfirm}
        orderCode={pendingReturnOrder?.code}
      />

      {/* Customer Delivery Details Dialog */}
      <Dialog open={showCustomerDetails} onOpenChange={setShowCustomerDetails}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[80vh] overflow-y-auto" dir={dir}>
          <DialogHeader>
            <DialogTitle>{t('store.dialog.customer.delivery')}</DialogTitle>
          </DialogHeader>
          {customerDetailsOrderId && (() => {
            const selectedOrder = orders.find(o => o.order_id === customerDetailsOrderId);
            if (selectedOrder) {
              const productName = (() => {
                if (selectedOrder.items && Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0) {
                  const productNames = selectedOrder.items.map(item => item.name)
                    .filter(name => name && name.trim() !== '')
                    .join(', ');
                  if (productNames) return productNames;
                }
                const orderRef = selectedOrder.order_code || selectedOrder.order_id.slice(0, 8);
                return `منتج طلب ${orderRef}`;
              })();

              return (
                <CustomerDeliveryDetails
                  order={{
                    id: selectedOrder.order_id,
                    order_code: selectedOrder.order_code,
                    customer_name: selectedOrder.customer_name,
                    customer_phone: selectedOrder.customer_phone,
                    customer_address: selectedOrder.customer_address,
                    customer_notes: selectedOrder.customer_notes,
                    total_amount: selectedOrder.total_amount,
                    subtotal: selectedOrder.subtotal,

                    created_at: selectedOrder.created_at,
                    order_status: selectedOrder.order_status,
                    store_response_status: selectedOrder.store_response_status,
                    order_items: selectedOrder.order_items
                  }}
                  productName={productName}
                  onDeliveryComplete={handleDeliveryComplete}
                />
              );
            }
            return null;
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoreDashboard;
