-- Set permanent subscriber for user: fff44f1d-25b9-4806-abe0-5cdccf755fba
-- This user will have the same subscription status as: ab5fe76d-a611-478f-a35f-28e9f3e73d5d

-- Insert or update the user subscription to permanent/lifetime status
INSERT INTO user_subscriptions (
  user_id,
  is_active,
  subscription_id,
  customer_id,
  product_id,
  status,
  current_period_start,
  created_at,
  updated_at,
  last_webhook_event,
  last_webhook_received_at,
  canceled_at,
  cancel_at_period_end,
  current_price_amount,
  current_price_currency
) VALUES (
  'fff44f1d-25b9-4806-abe0-5cdccf755fba',
  true,
  'lifetime-manual',
  'manual',
  'lifetime',
  'active',
  NOW(),
  NOW(),
  NOW(),
  'manual_grant',
  NOW(),
  NULL,
  false,
  NULL,
  'usd'
)
ON CONFLICT (user_id) DO UPDATE SET
  is_active = true,
  subscription_id = 'lifetime-manual',
  customer_id = 'manual',
  product_id = 'lifetime',
  status = 'active',
  current_period_start = COALESCE(EXCLUDED.current_period_start, user_subscriptions.current_period_start),
  last_webhook_event = 'manual_grant',
  last_webhook_received_at = NOW(),
  updated_at = NOW(),
  canceled_at = NULL,
  cancel_at_period_end = false;

-- Verification query: Check both permanent subscribers
-- Uncomment to verify after running the above SQL
/*
SELECT 
  user_id,
  is_active,
  subscription_id,
  customer_id,
  product_id,
  status,
  last_webhook_event,
  created_at,
  updated_at
FROM user_subscriptions 
WHERE user_id IN (
  'ab5fe76d-a611-478f-a35f-28e9f3e73d5d',
  'fff44f1d-25b9-4806-abe0-5cdccf755fba'
)
ORDER BY user_id;
*/
