export interface Transaction {
  _id: string;
  User_ID: string;
  Date: string;
  Time: string;
  Amount: number;
  Merchant_Category: string | number;
  Merchant_Type_Code?: number;
  Device_Type: string | number;
  Device_Type_Code?: number;
  Session_Time: number;
  Active_Loans: number;
  fraud_score?: number;
  fraud_token?: number;
  legit_token?: string;
  Avg_Amount?: number;
  Transactions_Per_Day?: number;
  Velocity?: number;
  Large_Transaction_Flag?: number;
  Large_Transaction_Frequency?: number;
}

export interface TransactionStats {
  totalTransactions: number;
  fraudTransactions: number;
  legitTransactions: number;
  fraudPercentage: number;
  avgAmount: number;
  lastUpdated: Date;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
  }[];
}

export interface MerchantCategory {
  code: number;
  name: string;
}

export interface DeviceType {
  code: number;
  name: string;
}

export const MERCHANT_CATEGORIES: Record<number, string> = {
  0: 'Luxury Goods',
  1: 'Travel',
  2: 'Electronics',
  3: 'Apparel',
  4: 'Food Delivery',
  5: 'Online Services',
  6: 'Groceries',
  7: 'Utilities',
  8: 'Medical',
  9: 'Wellness',
  10: 'Organic Grocery',
  11: 'Jewelry',
  12: 'Health',
  13: 'Hygiene Products',
  14: 'Apparel (gifts)',
  15: 'Food',
  16: 'Apparel Deals'
};

export const DEVICE_TYPES: Record<number, string> = {
  0: 'Mobile',
  1: 'PC',
  2: 'Tablet'
};

export interface TransactionFilters {
  userId?: string;
  minAmount?: number;
  maxAmount?: number;
  merchantCategory?: number;
  deviceType?: number;
  startDate?: string;
  endDate?: string;
  fraudOnly?: boolean;
  legitOnly?: boolean;
}