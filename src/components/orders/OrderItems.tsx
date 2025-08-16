import React from 'react';
import { OrderItem } from '@/types/order';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArabicText } from '@/components/ui/arabic-text';
import { formatPrice, calculateFinalPrice } from '@/utils/currency';
import { calculateOrderTotal, calculateItemTotal } from '@/utils/orderCalculations';
import { Package, ShoppingCart } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface OrderItemsProps {
  items?: OrderItem[] | Array<{
    name?: string;
    quantity?: number;
    price?: number;
    discounted_price?: number;
    main_store?: string;
    product_id?: number;
  }>;
  showPriceInBothCurrencies?: boolean;
  compact?: boolean;
}

export const OrderItems: React.FC<OrderItemsProps> = ({
  items,
  showPriceInBothCurrencies = true,
  compact = false
}) => {
  const { t } = useLanguage();
  if (!items || items.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex items-center justify-center text-muted-foreground">
            <Package className="w-6 h-6 ml-2" />
            <ArabicText>لا توجد منتجات في هذا الطلب</ArabicText>
          </div>
        </CardContent>
      </Card>
    );
  }

  // تشخيص البيانات في OrderItems
  console.log('📦 OrderItems - معالجة البيانات:', {
    items_count: items?.length || 0,
    items_summary: items?.map((item, index) => ({
      index: index,
      id: item.id,
      product_name: item.product_name,
      name: item.name
    }))
  });

  // Handle both OrderItem[] and the legacy format
  const normalizedItems = items.map((item, index) => {
    let productName = 'منتج غير محدد'; // قيمة افتراضية

    // تحسين استخراج اسم المنتج مع أولوية للـ product_name
    if ('product_name' in item && item.product_name &&
        typeof item.product_name === 'string' &&
        item.product_name.trim() !== '' &&
        item.product_name !== 'منتج غير محدد') {
      productName = item.product_name;
    } else if ('name' in item && item.name &&
               typeof item.name === 'string' &&
               item.name.trim() !== '' &&
               item.name !== 'منتج غير محدد') {
      productName = item.name;
    } else if ('products' in item && item.products && item.products.name &&
               typeof item.products.name === 'string' &&
               item.products.name.trim() !== '' &&
               item.products.name !== 'منتج غير محدد') {
      // استخدام اسم المنتج من جدول products المرتبط
      productName = item.products.name;
    } else {
      // في حالة عدم توفر أي اسم، استخدم رقم بسيط
      productName = `منتج ${index + 1}`;
    }

    console.log('🔍 OrderItems - Processing item:', {
      index,
      original_product_name: item.product_name,
      original_name: item.name,
      final_product_name: productName
    });

    return {
      id: 'id' in item ? item.id : `item-${Math.random()}`,
      product_name: productName,
      quantity: item.quantity || 1,
      price: item.price || 205000,
      discounted_price: item.discounted_price || 0
    };
  });

  // حساب المجموع مع تطبيق الخصم
  const total = normalizedItems.reduce((sum, item) => {
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
    return sum + (priceInfo.finalPrice * item.quantity);
  }, 0);

  const totalFormatted = formatPrice(total);

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShoppingCart className="w-4 h-4" />
          <ArabicText>المنتجات ({normalizedItems.length})</ArabicText>
        </div>
        {normalizedItems.map((item, index) => (
          <div key={item.id || index} className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <ArabicText className="font-medium text-blue-800">{item.product_name}</ArabicText>
                <div className="flex gap-2 mt-1">
                  <div className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1 py-0 rounded text-xs border dark:border-blue-700 w-fit h-5 flex items-center font-medium">
                    {t('quantity.label')} {item.quantity}
                  </div>
                </div>
              </div>
              <div className="text-right">
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

                  return priceInfo.hasDiscount ? (
                    <div className="space-y-1">
                      <div className="font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">
                        <span className="font-mono text-sm">
                          {priceInfo.finalPrice.toLocaleString('ar-EG')} د.ع
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 line-through">
                        {originalPrice.toLocaleString('ar-EG')} د.ع
                      </div>
                      <div className="text-xs text-green-600">
                        وفرت: {priceInfo.savings.toLocaleString('ar-EG')} د.ع
                      </div>
                    </div>
                  ) : (
                    <div className="font-bold text-green-700 bg-green-50 px-2 py-1 rounded border border-green-200">
                      <span className="font-mono text-sm">
                        {originalPrice.toLocaleString('ar-EG')} د.ع
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        ))}
        <div className="border-t pt-2">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-sm text-green-800">
                <ArabicText>الإجمالي:</ArabicText>
              </span>
              <span className="font-mono text-primary font-bold">
                {totalFormatted}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          <ArabicText>{t('product.details')} ({normalizedItems.length})</ArabicText>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {normalizedItems.map((item, index) => (
          <div key={item.id || index} className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h4 className="font-bold text-lg text-blue-800 mb-3">
                  <ArabicText>{item.product_name}</ArabicText>
                </h4>
                <div className="flex gap-3 flex-wrap">
                  <div className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1 py-0 rounded text-xs border dark:border-blue-700 w-fit h-5 flex items-center font-medium">
                    {t('quantity.label')} {item.quantity}
                  </div>
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

                    return priceInfo.hasDiscount ? (
                      <div className="space-y-1">
                        <div className="bg-red-50 px-3 py-1 rounded border border-red-200">
                          <span className="font-mono text-red-700 font-semibold">
                            {priceInfo.finalPrice.toLocaleString('ar-EG')} د.ع
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 line-through">
                          السعر الأصلي: {originalPrice.toLocaleString('ar-EG')} د.ع
                        </div>
                        <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                          وفرت: {priceInfo.savings.toLocaleString('ar-EG')} د.ع
                        </div>
                      </div>
                    ) : (
                      <div className="bg-green-50 px-3 py-1 rounded border border-green-200">
                        <span className="font-mono text-green-700 font-semibold">
                          {originalPrice.toLocaleString('ar-EG')} د.ع
                        </span>
                      </div>
                    );
                  })()}

                </div>
                <div className="mt-2 text-sm text-gray-600">
                  <span className="font-semibold">المجموع: </span>
                  <span className="font-mono text-green-700">
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
                      return formatPrice(priceInfo.finalPrice * item.quantity);
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        <div className="border-t pt-4">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-green-600" />
                <span className="font-bold text-lg text-green-800">
                  <ArabicText>{t('product.total')}:</ArabicText>
                </span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-700 font-mono">
                  {totalFormatted}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
