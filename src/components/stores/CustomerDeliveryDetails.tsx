import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Truck, Phone, MapPin, User, Calendar, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';
import { OrderItems } from '@/components/orders/OrderItems';
import { useToast } from '@/hooks/use-toast';
import { ArabicText } from '@/components/ui/arabic-text';
import { safeFormatDate } from '@/utils/dateUtils';
import { useLanguage } from '@/contexts/LanguageContext';

interface Order {
  id: string;
  order_code?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_notes?: string;
  total_amount?: number;
  subtotal?: number;
  created_at: string;
  order_status?: string;
  store_response_status?: string;
  order_items?: any[];
}

interface CustomerDeliveryDetailsProps {
  order: Order;
  productName: string;
  onDeliveryComplete?: (orderId: string) => void;
}

export function CustomerDeliveryDetails({
  order,
  productName,
  onDeliveryComplete
}: CustomerDeliveryDetailsProps) {
  const { t } = useLanguage();
  const { toast } = useToast();

  const handleDeliveryComplete = () => {
    toast({
      title: "تم التسليم ✅",
      description: "تم تأكيد تسليم الطلب بنجاح للعميل",
    });

    if (onDeliveryComplete) {
      onDeliveryComplete(order.id);
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Truck className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-blue-800">
                  {productName} - جاهز للتسليم
                </h3>
                <p className="text-sm text-blue-600">تفاصيل العميل للتسليم</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              🚚 جاهز للتسليم
            </Badge>
          </div>

          {/* Customer Details */}
          <div className="bg-white border border-blue-200 rounded-lg p-4">
            <h4 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
              <User className="w-4 h-4" />
              تفاصيل العميل
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-gray-500 mt-1" />
                  <div>
                    <span className="font-semibold text-gray-700">الاسم:</span>
                    <p className="text-gray-900 font-medium">
                      <ArabicText>
                        {(() => {
                          const name = order.customer_name?.trim();
                          if (name && name !== '') {
                            return name;
                          }
                          const orderRef = order.order_code || order.id.slice(0, 8);
                          return `${t('customer')} ${orderRef}`;
                        })()}
                      </ArabicText>
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-gray-500 mt-1" />
                  <div>
                    <span className="font-semibold text-gray-700">الهاتف:</span>
                    <p className="text-gray-900 font-mono text-lg">
                      {order.customer_phone || "غير محدد"}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-500 mt-1" />
                  <div>
                    <span className="font-semibold text-gray-700">العنوان:</span>
                    <p className="text-gray-900">{order.customer_address || "غير محدد"}</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-gray-500 mt-1" />
                  <div>
                    <span className="font-semibold text-gray-700">تاريخ الطلب:</span>
                    <p className="text-gray-900">
                      {safeFormatDate(order.created_at)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <DollarSign className="w-4 h-4 text-gray-500 mt-1" />
                  <div>
                    <span className="font-semibold text-gray-700">المبلغ الإجمالي:</span>
                    <p className="text-blue-600 font-bold text-lg">
                      {order.subtotal ? formatCurrency(order.subtotal) :
                       order.total_amount ? formatCurrency(order.total_amount) : "غير محدد"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Package className="w-4 h-4 text-gray-500 mt-1" />
                  <div>
                    <span className="font-semibold text-gray-700">رقم الطلب:</span>
                    <p className="text-gray-900 font-mono">
                      #{order.order_code || order.id.slice(0, 8)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Notes */}
            {order.customer_notes && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-yellow-700">📝 ملاحظات العميل:</span>
                  <span className="text-yellow-900">{order.customer_notes}</span>
                </div>
              </div>
            )}
          </div>

          {/* Order Items */}
          <div className="bg-white border border-blue-200 rounded-lg p-4">
            <h4 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
              <Package className="w-4 h-4" />
              المنتجات المطلوبة
            </h4>
            {(() => {
              if (order.order_items && Array.isArray(order.order_items) && order.order_items.length > 0) {
                return <OrderItems items={order.order_items} compact={false} />;
              }

              const orderRef = order.order_code || order.id.slice(0, 8);
              const defaultItem = {
                id: `default-${order.id}`,
                product_name: productName,
                quantity: 1,
                price: order.total_amount || order.subtotal || 0,
                discounted_price: order.total_amount || order.subtotal || 0
              };

              return <OrderItems items={[defaultItem]} compact={false} />;
            })()}
          </div>

          {/* Delivery Action */}
          <div className="flex justify-center">
            <Button 
              size="lg" 
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg font-bold"
              onClick={handleDeliveryComplete}
            >
              ✅ تم التسليم
            </Button>
          </div>

          {/* Instructions */}
          <div className="text-center text-xs text-blue-600 bg-blue-100 p-3 rounded-lg">
            <p className="font-medium">تعليمات التسليم:</p>
            <p>تأكد من هوية العميل قبل ال��سليم • احصل على توقيع الاستلام • اضغط "تم التسليم" بعد التأكد</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default CustomerDeliveryDetails;
