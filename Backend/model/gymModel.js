import mongoose from "mongoose";

const gymSchema = new mongoose.Schema({
    gymName: {
        type: String,
        required: [true, "Gym Name is required"],
        trim: true
    },
    address: {
        location: { type: String, required: true },
        place_id: { type: String },
        street: { type: String }
    },
    coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    pricing: {
        hourlyRate: { type: Number, required: true, min: 0 },
        weeklyRate: { type: Number, required: true, min: 0 },
        monthlyRate: { type: Number, required: true, min: 0 }
    },
    personalTrainerPricing: {
        hourlyRate: { type: Number, required: true, min: 0 },
        weeklyRate: { type: Number, required: true, min: 0 },
        monthlyRate: { type: Number, required: true, min: 0 }
    },
    timings: {
      morning: {
        openingTime: {
          type: Date,
          required: true
        },
        closingTime: {
          type: Date,
          required: true,
          validate: {
            validator: function (value) {
              return (
                value &&
                this.openingTime &&
                value.getTime() > this.openingTime.getTime()
              );
            },
            message: 'Morning closing time must be after opening time'
          }
        },
        slots: [
          {
            start: { type: String, required: true },  
            end: { type: String, required: true },    
            maxPeople: { type: Number, required: true }
          }
        ]
      },
      evening: {
        openingTime: {
          type: Date,
          required: true
        },
        closingTime: {
          type: Date,
          required: true,
          validate: {
            validator: function (value) {
              return (
                value &&
                this.openingTime &&
                value.getTime() > this.openingTime.getTime()
              );
            },
            message: 'Evening closing time must be after opening time'
          }
        },
        slots: [
          {
            start: { type: String, required: true },
            end: { type: String, required: true },
            maxPeople: { type: Number, required: true }
          }
        ]
      }
    }
    ,
    currency: {
      name:{
        type: String,
        required: true,
        enum: ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'RUB', 'KRW'],
        default: 'INR'
      },
      symbol:{
        type:String,
        required:true,
        defualt:'₹',
      }
    },
    description: {
        type: String,
        required: true,
        maxlength: [500, "Description cannot be more than 500 characters"]
    },
    gymOwner: {
        type: String,
        required: true
    },
    isDeleted:{
        type:Boolean,
        default:false,
    },
    images:{
        url:{type:String, required:true}, 
        public_id:{type:String, required:true},
    },
    amenities: [
      {
        id: { type: String, required: true },
        label: { type: String, required: true },
        checked: { type: Boolean, required: true },
      },
    ],
}, {
    timestamps: true
});

// Add index for geospatial queries if needed
gymSchema.index({ coordinates: '2dsphere' });

const GymAdd = mongoose.model("Gym", gymSchema);

export default GymAdd;  