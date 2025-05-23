import React, { useEffect, useState, useRef } from 'react';
import { useKindeAuth } from '@kinde-oss/kinde-auth-react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { load } from '@cashfreepayments/cashfree-js';

const CheckPrice = () => {
  const { gymId } = useParams();
  const { getToken, user } = useKindeAuth();
  const [price, setPrice] = useState({ pricing: {}, personalTrainerPricing: {} });
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [gymName, setGymName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();
  
  // Ensure selectedTime is always an array
  const { selectedDate = "", selectedTime = [] } = location.state || {};
  const numberOfSlots = selectedTime.length || 1;
  
  console.log("Selected slots data:", { selectedDate, selectedTime, numberOfSlots });
  
  const navigate = useNavigate();
  const cashfree = useRef(null);

  // Fetch gym pricing
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        setIsLoading(true);
        const token = await getToken();
        const res = await axios.get(`http://localhost:4000/api/getSingleGym/${gymId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        setPrice({
          pricing: res.data.pricing || {},
          personalTrainerPricing: res.data.personalTrainerPricing || {},
          currency: res.data.currency || { symbol: "₹" }
        });
        setGymName(res.data.gymName || "Unknown Gym");
      } catch (error) {
        console.error("Error fetching gym data:", error);
        toast.error("Failed to load pricing.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchPrice();
  }, [gymId, getToken]);

  // Set booking start & end dates
  useEffect(() => {
    if (!selectedPlan || !selectedDate) return;

    const start = new Date(selectedDate);
    setStartDate(start.toISOString().split('T')[0]);

    let end = new Date(start);
    if (selectedPlan.includes("Weekly")) {
      end.setDate(end.getDate() + 6);
    } else if (selectedPlan.includes("Monthly")) {
      end.setDate(end.getDate() + 30);
    }
    setEndDate(end.toISOString().split('T')[0]);
  }, [selectedPlan, selectedDate]);

  // Load Cashfree SDK
  useEffect(() => {
    const initCashfree = async () => {
      try {
        cashfree.current = await load({ mode: "sandbox" });
      } catch (err) {
        console.error("Cashfree SDK load failed:", err);
        toast.error("Cashfree failed to load");
      }
    };
    initCashfree();
  }, []);

  const handlePlanSelect = (plan) => {
    if (selectedTime.length === 0) {
      toast.error("Please select at least one time slot first");
      return;
    }
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  const handleProceedToPayment = async () => {
    if (!phoneNumber || phoneNumber.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    const buyerName = user?.givenName || user?.name || "Gym User";
    const email = user?.email || "test@example.com";
    const today = new Date().toISOString().split('T')[0];

    try {
      const token = await getToken();

      // Check for existing bookings
      const checkRes = await axios.get(
        `http://localhost:4000/api/booking-active/${user?.id}/${gymId}`, 
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (checkRes.data.conflict) {
        const { startDate, endDate } = checkRes.data.booking;
        toast.error(`You already have an active plan from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}.`);
        setIsModalOpen(false);
        return;
      }

      let rate;
      let baseRate;

      // Get base rate for the selected plan
      if (selectedPlan.includes("Hourly Plan With Trainer")) baseRate = price.personalTrainerPricing.hourlyRate;
      else if (selectedPlan.includes("Hourly Plan")) baseRate = price.pricing.hourlyRate;
      else if (selectedPlan.includes("Weekly Plan With Trainer")) baseRate = price.personalTrainerPricing.weeklyRate;
      else if (selectedPlan.includes("Weekly Plan")) baseRate = price.pricing.weeklyRate;
      else if (selectedPlan.includes("Monthly Plan With Trainer")) baseRate = price.personalTrainerPricing.monthlyRate;
      else if (selectedPlan.includes("Monthly Plan")) baseRate = price.pricing.monthlyRate;
      else {
        toast.error("Invalid plan");
        return;
      }

      // Calculate total amount based on number of slots
      rate = baseRate * numberOfSlots;

      // Format bookingTimeSlots for backend
      const bookingTimeSlots = selectedTime.map(slot => ({
        date: selectedDate,
        time: slot.time,
        slotId: slot._id
      }));

      console.log("booking Time slots", bookingTimeSlots)

      // Call backend to create payment session
      const res = await axios.post(
        "http://localhost:4000/api/createCashfreeOrder",
        {
          userId: user?.id,
          buyer_name: buyerName,
          email,
          phone: phoneNumber,
          gymId,
          selectedPlan,
          amount: rate,
          baseAmount: baseRate,
          numberOfSlots,
          currency: "INR",
          startDate,
          endDate,
          gymNames: gymName,
          bookingDate: today,
          bookingTimeSlots, // Properly formatted array
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const sessionId = res.data.paymentSessionId;

      // Cashfree Checkout
      if (cashfree.current) {
        await cashfree.current.checkout({
          paymentSessionId: sessionId,
          redirectTarget: "_self"
        });
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Payment failed. Try again.");
    }

    setPhoneNumber('');
    setSelectedPlan(null);
    setIsModalOpen(false);
  };

  // Display price with number of slots
  const renderPlanPrice = (plan) => {
    const totalPrice = plan.rate * numberOfSlots;
    return (
      <>
        <p className="text-lg">
          {plan.symbol}{plan.rate} per slot {numberOfSlots > 1 && `× ${numberOfSlots}`}
        </p>
        {numberOfSlots > 1 && (
          <p className="text-3xl font-bold mt-2">
            Total: {plan.symbol}{totalPrice}
          </p>
        )}
      </>
    );
  };

  return (
    <div className='container mx-auto px-4 py-8'>
      <button onClick={() => navigate(-1)} className="mb-6 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-600 transition cursor-pointer">
        Back
      </button>

      <div className='text-center'>
        <h2 className="text-3xl font-bold sm:text-5xl">Choose Your Plan</h2>
        <p className="max-w-3xl mx-auto mt-4 text-xl">Choose a plan that fits your needs and upgrade anytime.</p>
        {numberOfSlots > 0 && (
          <p className="text-lg text-blue-600 mt-2">
            Booking {numberOfSlots} slot{numberOfSlots > 1 ? 's' : ''} on {new Date(selectedDate).toLocaleDateString()}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center space-x-2 mt-10">
          <div className="w-5 h-5 bg-[#d991c2] rounded-full animate-bounce"></div>
          <div className="w-5 h-5 bg-[#9869b8] rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
          <div className="w-5 h-5 bg-[#6756cc] rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-8 mt-8">
          {[
            { name: "Hourly Plan", symbol: price?.currency?.symbol, rate: price?.pricing?.hourlyRate, duration: "hour" },
            { name: "Hourly Plan With Trainer", symbol: price?.currency?.symbol, rate: price?.personalTrainerPricing?.hourlyRate, duration: "hour" },
            { name: "Weekly Plan", symbol: price?.currency?.symbol, rate: price?.pricing?.weeklyRate, duration: "week" },
            { name: "Weekly Plan With Trainer", symbol: price?.currency?.symbol, rate: price?.personalTrainerPricing?.weeklyRate, duration: "week" },
            { name: "Monthly Plan", symbol: price?.currency?.symbol, rate: price?.pricing?.monthlyRate, duration: "month" },
            { name: "Monthly Plan With Trainer", symbol: price?.currency?.symbol, rate: price?.personalTrainerPricing?.monthlyRate, duration: "month" }
          ].map((plan) => (
            <div key={plan.name} className="group relative cursor-pointer w-full overflow-hidden bg-white px-6 pt-10 pb-8 shadow-xl ring-1 ring-gray-900/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl sm:mx-auto sm:max-w-sm sm:rounded-lg sm:px-10">
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="text-gray-600 mt-2">Access to gym facilities</p>
              {renderPlanPrice(plan)}
              <button 
                onClick={() => handlePlanSelect(plan.name)}
                className="text-black hover:before:bg-black relative h-[40px] w-30 overflow-hidden border border-black bg-white px-3 py-2 text-black shadow-2xl transition-all before:absolute before:bottom-0 before:left-0 before:top-0 before:z-0 before:h-full before:w-0 before:bg-black before:transition-all before:duration-500 hover:text-white hover:shadow-black hover:before:left-0 hover:before:w-full mt-2 cursor-pointer"
              >
                <span className="relative">Choose</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Phone Number Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-10 flex justify-center items-center">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96 text-center">
            <h3 className="text-xl font-bold">Enter Your Phone Number</h3>
            <input
              type="tel"
              placeholder="Enter phone number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="border border-gray-400 rounded-md p-2 mt-4 w-full text-center"
              maxLength={10}
            />
            <div className="flex justify-center gap-4 mt-6">
              <button
                onClick={handleProceedToPayment}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-800 transition cursor-pointer"
              >
                Proceed to Payment
              </button>
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2 bg-yellow-400 text-white rounded-lg hover:bg-yellow-600 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckPrice;