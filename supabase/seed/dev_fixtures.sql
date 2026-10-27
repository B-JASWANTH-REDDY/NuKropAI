-- ══════════════════════════════════════════════════════════════════════════════
-- NuKropAI - DEVELOPMENT & DEMO FIXTURES ONLY
-- ══════════════════════════════════════════════════════════════════════════════
-- DO NOT RUN IN PRODUCTION!
-- This script populates sample/mock records for local testing and UI emulator.
-- ══════════════════════════════════════════════════════════════════════════════

-- Seed Regional Pooled Truck Fleet Fixtures (GramHaul Demo)
INSERT INTO public.truck_listings (
    id, driver_name, driver_phone, truck_type, vehicle_type, vehicle_plate, 
    capacity_tonnes, available_capacity_tonnes, capacity_tons, total_bags_capacity, filled_bags, 
    rate_per_bag, rate_per_km, solo_rate, origin_village, destination_mandi, current_mandi, 
    departure_time, pickup_eta, latitude, longitude, is_cold_chain, status, rating, trips_count
) VALUES
(
    'TRK-8419', 'Ramesh Yadav', '+91 98492 11048', 'Tata 407 (Heavy Duty)', 'Tata 407 (Heavy Duty)', 'TS-03-UB-8419',
    3.5, 1.0, 3.5, 30, 22, 
    45.00, 22.00, 1800.00, 'Narsampet Rural', 'Warangal Enumamula APMC Yard', 'Warangal Enumamula APMC Yard',
    'Today, 4:30 PM', '25 mins', 17.9750, 79.5990, FALSE, 'ACTIVE', 4.9, 142
),
(
    'TRK-4920', 'K. Venkatesham', '+91 94401 77391', 'Eicher Pro 2049 (Express)', 'Eicher Pro 2049 (Express)', 'AP-36-TA-4920',
    5.0, 1.5, 5.0, 45, 31, 
    65.00, 28.00, 2800.00, 'Station Road, Warangal', 'Bowenpally APMC, Hyderabad', 'Bowenpally APMC, Hyderabad',
    'Today, 6:00 PM', '45 mins', 17.9880, 79.6150, FALSE, 'ACTIVE', 4.8, 98
),
(
    'TRK-1102', 'Md. Ismail Khan', '+91 99890 32184', 'Mahindra Bolero Maxi Truck', 'Mahindra Bolero Maxi Truck', 'TS-04-EA-1102',
    2.0, 0.6, 2.0, 20, 14, 
    45.00, 18.00, 1400.00, 'Mulugu Hub', 'Warangal Enumamula APMC Yard', 'Warangal Enumamula APMC Yard',
    'Today, 5:15 PM', '35 mins', 17.9620, 79.6050, FALSE, 'ACTIVE', 4.9, 210
),
(
    'TRK-3391', 'Gurpreet Singh', '+91 98765 43210', 'Tata Ace (Chhota Hathi)', 'Tata Ace (Chhota Hathi)', 'PB-10-CZ-3391',
    1.5, 1.0, 1.5, 15, 5, 
    40.00, 16.00, 1200.00, 'Kazipet Mandi Gate', 'Warangal APMC Yard', 'Warangal APMC Yard',
    'Today, 5:45 PM', '20 mins', 17.9820, 79.5820, FALSE, 'ACTIVE', 5.0, 36
)
ON CONFLICT (id) DO NOTHING;

-- Seed Community Posts Demo Fixtures
INSERT INTO public.community_posts (
    id, author_name, author_village, crop_id, title, content, likes_count, comments_count, is_verified
) VALUES
(
    'post-1', 'Rajeshwar Rao', 'Geesugonda, Warangal', 'cotton',
    'Success with Dashaparni Kashayam on Cotton Thrips',
    'Sprayed Dashaparni Kashayam 1:10 dilution on 3 acres of Cotton early morning. Sucking pests under control within 48 hours without burning leaves!',
    24, 6, true
),
(
    'post-2', 'Srinivas Reddy', 'Dharmaram Rural', 'chilli',
    'Teja Chilli APMC Rate Alert — Warangal Yard',
    'Teja quality chilli fetched ₹21,500/quintal today at Warangal Enumamula yard. Moisture level was below 10%. Demand is high!',
    18, 4, true
),
(
    'post-3', 'Venkatesh Naik', 'Mulugu Hub', 'paddy',
    'Direct Seeding (DSR) Trial Results',
    'Tried DSR method on 2 acres this Kharif season. Saved almost 35% irrigation water and labor cost. Tillering is excellent so far.',
    31, 9, true
)
ON CONFLICT (id) DO NOTHING;
