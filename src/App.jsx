
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

const locations = [
  "Talaimari",
  "Kazla",
  "Binodpur",
  "Motihar",
  "Shaheb Bazar",
  "Laxmipur",
  "Court Station",
  "Upashahar",
];

const propertyTypes = ["Flat", "Sublet", "Hostel"];

const renterLabels = {
  bachelors: "Bachelor",
  families: "Family",
};

const facilityOptions = [
  { label: "Wi-Fi", value: "wifi" },
  { label: "Attached bathroom", value: "attached_bathroom" },
  { label: "Kitchen", value: "kitchen" },
  { label: "Gas supply", value: "gas_supply" },
  { label: "Parking", value: "parking" },
];

const facilityLabels = Object.fromEntries(
  facilityOptions.map(({ label, value }) => [value, label])
);

const rentRanges = [
  { label: "Under ৳3,000", min: 0, max: 3000 },
  { label: "৳3,000–৳5,000", min: 3000, max: 5000 },
  { label: "৳5,000–৳8,000", min: 5000, max: 8000 },
  { label: "৳8,000–৳12,000", min: 8000, max: 12000 },
  { label: "Above ৳12,000", min: 12000, max: Infinity },
];

const fallbackImage =
  "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=800&q=80";

const inputClass =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const labelClass = "block text-sm font-semibold text-slate-800";

const initialForm = {
  title: "",
  description: "",
  propertyType: "flat",
  location: "",
  rent: "",
  suitableFor: [],
  gender: "any",
  roomCount: "",
  availableSeats: "",
  roomSharingType: "",
  phone: "",
  facilities: [],
};

export default function App() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshListings, setRefreshListings] = useState(0);

  const [roomCount, setRoomCount] = useState("");
  const [location, setLocation] = useState("");
  const [rentRange, setRentRange] = useState("");
  const [type, setType] = useState("");
  const [renter, setRenter] = useState("");
  const [gender, setGender] = useState("");
  const [selectedFacilities, setSelectedFacilities] = useState([]);
  const [showAll, setShowAll] = useState(false);

  const [selectedProperty, setSelectedProperty] = useState(null);

  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [selectedImages, setSelectedImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [submissionSuccess, setSubmissionSuccess] = useState("");

  useEffect(() => {
    async function loadProperties() {
      setLoading(true);
      setLoadError("");

      try {
        const now = new Date().toISOString();

        const { data: listings, error: listingsError } = await supabase
          .from("properties")
          .select(
            "id, title, description, phone, location, rent_amount, property_type, suitable_for, gender_preference, room_count, available_seats, room_sharing_type, created_at"
          )
          .eq("status", "published")
          .eq("availability_status", "available")
          .gt("expires_at", now)
          .order("created_at", { ascending: false });

        if (listingsError) throw listingsError;

        if (!listings || listings.length === 0) {
          setProperties([]);
          return;
        }

        const ids = listings.map((item) => item.id);

        const [
          { data: facilityRows, error: facilitiesError },
          { data: imageRows, error: imagesError },
        ] = await Promise.all([
          supabase
            .from("property_facilities")
            .select("property_id, facility")
            .in("property_id", ids),

          supabase
            .from("property_images")
            .select("property_id, storage_path, display_order")
            .in("property_id", ids)
            .order("display_order", { ascending: true }),
        ]);

        if (facilitiesError) throw facilitiesError;
        if (imagesError) throw imagesError;

        const mappedProperties = listings.map((item) => {
          const listingFacilities = (facilityRows || [])
            .filter((row) => row.property_id === item.id)
            .map((row) => facilityLabels[row.facility] || row.facility);

          const listingImages = (imageRows || [])
            .filter((row) => row.property_id === item.id)
            .map(
              (row) =>
                supabase.storage
                  .from("property-images")
                  .getPublicUrl(row.storage_path).data.publicUrl
            );

          return {
            id: item.id,
            title: item.title,
            description: item.description || "",
            phone: item.phone || "",
            location: item.location,
            rent: Number(item.rent_amount),
            roomCount: item.room_count,
            availableSeats: item.available_seats,
            roomSharingType: item.room_sharing_type,
            type:
              item.property_type === "flat"
                ? "Flat"
                : item.property_type === "sublet"
                  ? "Sublet"
                  : "Hostel",
            suitableFor: (item.suitable_for || []).map(
              (value) => renterLabels[value] || value
            ),
            gender: item.gender_preference || "any",
            images: listingImages.length ? listingImages : [fallbackImage],
            image: listingImages[0] || fallbackImage,
            facilities: listingFacilities,
          };
        });

        setProperties(mappedProperties);
      } catch (error) {
        console.error("Failed to load listings:", error.message);
        setLoadError(
          "We couldn't load listings. Please refresh and try again."
        );
      } finally {
        setLoading(false);
      }
    }

    loadProperties();
  }, [refreshListings]);

  // Lock background scrolling and support closing with Escape.
  useEffect(() => {
    if (!selectedProperty) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setSelectedProperty(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedProperty]);

  const hasFilters = Boolean(
    roomCount ||
      location ||
      rentRange ||
      type ||
      renter ||
      (renter === "Bachelor" && gender) ||
      selectedFacilities.length
  );

  const filteredProperties = properties.filter((property) => {
    const matchesLocation = !location || property.location === location;

    const selectedRange = rentRanges.find(
      (range) => range.label === rentRange
    );

    const matchesRent =
      !selectedRange ||
      (property.rent >= selectedRange.min &&
        (selectedRange.max === Infinity
          ? true
          : rentRange === "Under ৳3,000"
            ? property.rent < selectedRange.max
            : rentRange === "Above ৳12,000"
              ? property.rent > selectedRange.min
              : property.rent <= selectedRange.max));

    const matchesType = !type || property.type === type;
    const matchesRenter =
      !renter || property.suitableFor.includes(renter);

    const matchesGender =
      renter !== "Bachelor" ||
      !gender ||
      property.gender === "any" ||
      property.gender === gender;

    const matchesRoomCount =
      !roomCount ||
      (property.roomCount !== null &&
        property.roomCount !== undefined &&
        (roomCount === "4+"
          ? property.roomCount >= 4
          : property.roomCount === Number(roomCount)));

    const matchesFacilities = selectedFacilities.every((facility) =>
      property.facilities.includes(facility)
    );

    return (
      matchesLocation &&
      matchesRent &&
      matchesType &&
      matchesRenter &&
      matchesGender &&
      matchesRoomCount &&
      matchesFacilities
    );
  });

  const visibleProperties =
    hasFilters || showAll
      ? filteredProperties
      : filteredProperties.slice(0, 3);

  function toggleFacility(facility) {
    setSelectedFacilities((current) =>
      current.includes(facility)
        ? current.filter((item) => item !== facility)
        : [...current, facility]
    );
  }

  function clearFilters() {
    setLocation("");
    setRoomCount("");
    setRentRange("");
    setType("");
    setRenter("");
    setGender("");
    setSelectedFacilities([]);
    setShowAll(false);
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleTenant(tenant) {
    setForm((current) => {
      const currentlySelected = current.suitableFor.includes(tenant);

      const suitableFor = currentlySelected
        ? current.suitableFor.filter((item) => item !== tenant)
        : [...current.suitableFor, tenant];

      return {
        ...current,
        suitableFor,
        gender:
          tenant === "bachelors" && currentlySelected
            ? "any"
            : current.gender,
      };
    });
  }

  function toggleBothTenants() {
    setForm((current) => {
      const bothSelected =
        current.suitableFor.includes("bachelors") &&
        current.suitableFor.includes("families");

      return {
        ...current,
        suitableFor: bothSelected ? [] : ["bachelors", "families"],
        gender: bothSelected ? "any" : current.gender,
      };
    });
  }

  function toggleFormFacility(facility) {
    setForm((current) => ({
      ...current,
      facilities: current.facilities.includes(facility)
        ? current.facilities.filter((item) => item !== facility)
        : [...current.facilities, facility],
    }));
  }

  function handleImageChange(event) {
    const files = Array.from(event.target.files || []);
    setSubmissionError("");
    setSubmissionSuccess("");

    if (files.length > 5) {
      setSelectedImages([]);
      event.target.value = "";
      setSubmissionError("You can select up to 5 photos.");
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp"];

    const invalidImage = files.find(
      (file) =>
        !validTypes.includes(file.type) ||
        file.size === 0 ||
        file.size > 5 * 1024 * 1024
    );

    if (invalidImage) {
      setSelectedImages([]);
      event.target.value = "";
      setSubmissionError(
        "Use JPEG, PNG, or WebP photos. Each photo must be 5 MB or smaller."
      );
      return;
    }

    setSelectedImages(files);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmissionError("");
    setSubmissionSuccess("");

    const description = form.description.trim();

    if (description && (description.length < 10 || description.length > 3000)) {
      setSubmissionError(
        "If you provide a description, it must be 10–3,000 characters."
      );
      return;
    }

    if (form.suitableFor.length === 0) {
      setSubmissionError("Choose Bachelor, Family, or Both.");
      return;
    }

    if (form.propertyType === "hostel" && !form.roomSharingType) {
      setSubmissionError("Choose Single room or Double room for the hostel.");
      return;
    }

    if (selectedImages.length === 0) {
      setSubmissionError("Please upload at least one property photo.");
      return;
    }

    const rent = Number(form.rent);

    if (!Number.isSafeInteger(rent) || rent <= 0) {
      setSubmissionError("Enter a valid monthly rent.");
      return;
    }

    const roomCountValue =
      form.roomCount === "" ? null : Number(form.roomCount);

    const seatsValue =
      form.availableSeats === "" ? null : Number(form.availableSeats);

    if (
      (roomCountValue !== null &&
        (!Number.isSafeInteger(roomCountValue) || roomCountValue < 0)) ||
      (seatsValue !== null &&
        (!Number.isSafeInteger(seatsValue) || seatsValue < 0))
    ) {
      setSubmissionError(
        "Room count and available seats must be zero or a positive whole number."
      );
      return;
    }

    if (!/^\d{11}$/.test(form.phone)) {
      setSubmissionError("Enter a valid phone number with exactly 11 digits.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: description || null,
      property_type: form.propertyType,
      location: form.location,
      rent_amount: rent,
      suitable_for: form.suitableFor,
      gender_preference: form.suitableFor.includes("bachelors")
        ? form.gender
        : "any",
      room_count: roomCountValue,
      available_seats:
        form.propertyType === "sublet" || form.propertyType === "hostel"
          ? seatsValue
          : null,
      room_sharing_type:
        form.propertyType === "hostel" ? form.roomSharingType : null,
      phone: form.phone,
      facilities: form.facilities,
    };

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      setSubmissionError(
        "Supabase configuration is missing. Please check your environment variables."
      );
      return;
    }

    const formData = new FormData();
    formData.append("data", JSON.stringify(payload));

    selectedImages.forEach((image) => {
      formData.append("images", image);
    });

    setSubmitting(true);

    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/dynamic-service`,
        {
          method: "POST",
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: formData,
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "We couldn't submit your listing. Please try again."
        );
      }

      setSubmissionSuccess("Your listing has been published successfully!");
      setForm(initialForm);
      setSelectedImages([]);
      setRefreshListings((current) => current + 1);
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "Submission failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="flex items-center justify-between gap-4 border-b bg-white px-5 py-4 md:px-12">
        <a href="/" className="text-xl font-bold tracking-tight sm:text-2xl">
          Rajshahi <span className="text-blue-600">Rentals</span>
        </a>

        <button
          type="button"
          onClick={() => {
            setShowSubmissionForm(true);
            document
              .getElementById("list-property")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          + List your property
        </button>
      </header>

      <section
        className="bg-slate-800 bg-cover bg-center px-5 pb-16 pt-16 text-white md:px-12 md:pb-24 md:pt-24"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(9,25,48,.88), rgba(9,25,48,.45)), url('/images/rajshahi-hero.jpg')",
        }}
      >
        <div className="mx-auto max-w-7xl">
          <p className="mb-4 font-medium text-blue-200">
            FIND YOUR PERFECT PLACE IN RAJSHAHI
          </p>

          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Your next home starts here.
          </h1>

          <p className="mt-5 max-w-xl text-base text-slate-200 sm:text-lg">
            Flats, sublets and hostels. Find a place that fits your needs and
            budget.
          </p>

          <div className="mt-10 rounded-2xl bg-white p-5 text-slate-900 shadow-2xl sm:p-7">
            <h2 className="mb-6 text-xl font-bold">Find your ideal rental</h2>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <label className={labelClass}>
                Location
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className={inputClass}
                >
                  <option value="">All locations</option>
                  {locations.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </label>

              <label className={labelClass}>
                Number of rooms
                <select
                  value={roomCount}
                  onChange={(e) => setRoomCount(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Any number of rooms</option>
                  <option value="1">1 room</option>
                  <option value="2">2 rooms</option>
                  <option value="3">3 rooms</option>
                  <option value="4+">4+ rooms</option>
                </select>
              </label>

              <label className={labelClass}>
                Monthly rent
                <select
                  value={rentRange}
                  onChange={(e) => setRentRange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Any rent</option>
                  {rentRanges.map((range) => (
                    <option key={range.label} value={range.label}>
                      {range.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={labelClass}>
                Property type
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Any type</option>
                  {propertyTypes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className={labelClass}>
                Who will be living here?
                <select
                  value={renter}
                  onChange={(e) => {
                    setRenter(e.target.value);
                    setGender("");
                  }}
                  className={inputClass}
                >
                  <option value="">Any renter type</option>
                  <option value="Bachelor">Bachelor</option>
                  <option value="Family">Family</option>
                </select>
              </label>

              {renter === "Bachelor" && (
                <label className={labelClass}>
                  Gender
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Any gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </label>
              )}
            </div>

            <fieldset className="mt-6">
              <legend className="text-sm font-semibold">
                Preferred facilities
              </legend>

              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
                {facilityOptions.map((facility) => (
                  <label
                    key={facility.label}
                    className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFacilities.includes(facility.label)}
                      onChange={() => toggleFacility(facility.label)}
                      className="size-4 accent-blue-600"
                    />
                    {facility.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg border border-slate-300 px-5 py-3 font-semibold transition hover:bg-slate-50"
              >
                Clear filters
              </button>

              <button
                type="button"
                onClick={() => {
                  clearFilters();
                  setShowAll(true);
                }}
                className="ml-auto text-sm font-semibold text-blue-600 hover:underline"
              >
                See all listings →
              </button>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Results update automatically as you change your filters.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-10 sm:grid-cols-3 md:px-12">
        {[
          ["Listings from local owners", "Explore property information"],
          ["Made for Rajshahi", "Find homes around your area"],
          ["Easy to use", "Search by your own needs"],
        ].map(([title, description]) => (
          <div key={title} className="text-center">
            <h3 className="font-bold">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-5 py-8 md:px-12 md:py-12">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">
              {hasFilters
                ? "Matching rentals"
                : showAll
                  ? "All rental listings"
                  : "Featured listings"}
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              {hasFilters
                ? "Properties matching your selected preferences."
                : "Explore available places in Rajshahi."}
            </p>
          </div>

          <p className="text-sm text-slate-500">
            {loading
              ? "Loading..."
              : `${visibleProperties.length} properties found`}
          </p>
        </div>

        {loading ? (
          <p className="py-10 text-center text-slate-500">
            Loading available rentals...
          </p>
        ) : loadError ? (
          <p className="py-10 text-center text-red-600">{loadError}</p>
        ) : visibleProperties.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProperties.map((property) => (
              <article
                key={property.id}
                role="button"
                tabIndex={0}
                aria-label={`View details for ${property.title}`}
                onClick={() => setSelectedProperty(property)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedProperty(property);
                  }
                }}
                className="cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <img
                  src={property.image}
                  alt={property.title}
                  loading="lazy"
                  className="h-52 w-full object-cover"
                />

                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {property.type}
                    </span>
                    <span className="text-sm text-slate-500">
                      {property.location}
                    </span>
                  </div>

                  <h3 className="mt-4 text-lg font-bold">{property.title}</h3>

                  <p className="mt-3 text-xl font-bold text-blue-600">
                    ৳{property.rent.toLocaleString("en-BD")}
                    <span className="text-sm font-normal text-slate-500">
                      {" "}/ month
                    </span>
                  </p>

                  <p className="mt-3 text-sm text-slate-600">
                    Suitable for: {property.suitableFor.join(", ")}
                  </p>

                  {property.roomCount != null && (
                    <p className="mt-2 text-sm text-slate-600">
                      Number of rooms: {property.roomCount}
                    </p>
                  )}

                  {property.availableSeats != null && (
                    <p className="mt-2 text-sm text-slate-600">
                      Available seats: {property.availableSeats}
                    </p>
                  )}

                  {property.roomSharingType && (
                    <p className="mt-2 text-sm text-slate-600">
                      Hostel room:{" "}
                      {property.roomSharingType === "single"
                        ? "Single room (1 person)"
                        : property.roomSharingType === "double"
                          ? "Double room (2 people)"
                          : property.roomSharingType}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {property.facilities.map((facility) => (
                      <span
                        key={facility}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                      >
                        {facility}
                      </span>
                    ))}
                  </div>

                  <p className="mt-5 text-sm font-semibold text-blue-600">
                    View property details →
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-10 text-center">
            <h3 className="text-lg font-bold">No matching rentals found</h3>
            <p className="mt-2 text-sm text-slate-500">
              Try a different location, rent range, or renter type.
            </p>
            <button
              onClick={clearFilters}
              className="mt-5 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white"
            >
              Clear filters
            </button>
          </div>
        )}
      </section>

      <section
        id="list-property"
        className="bg-slate-900 px-5 py-12 text-white md:px-12 md:py-16"
      >
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Have a property to rent?
          </h2>
          <p className="mt-3 max-w-xl text-slate-300">
            Share your space and help someone find their next home in Rajshahi.
          </p>

          <button
            type="button"
            onClick={() => {
              setShowSubmissionForm((current) => !current);
              setSubmissionError("");
              setSubmissionSuccess("");
            }}
            className="mt-6 rounded-lg bg-white px-5 py-3 font-semibold text-slate-900 hover:bg-blue-50"
          >
            {showSubmissionForm ? "Close form" : "+ Submit a listing"}
          </button>

          {showSubmissionForm && (
            <form
              onSubmit={handleSubmit}
              className="mt-8 space-y-7 rounded-2xl bg-white p-5 text-slate-900 sm:p-8"
            >
              <div>
                <h3 className="text-xl font-bold">List your property</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Fill in the details below. Your listing will be published
                  after successful submission.
                </p>
              </div>

              {submissionError && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
                >
                  {submissionError}
                </p>
              )}

              {submissionSuccess && (
                <p
                  role="status"
                  className="rounded-lg bg-green-50 p-3 text-sm text-green-700"
                >
                  {submissionSuccess}
                </p>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <label className={labelClass}>
                  Listing title *
                  <input
                    required
                    minLength={5}
                    maxLength={120}
                    value={form.title}
                    onChange={(e) => updateForm("title", e.target.value)}
                    placeholder="e.g. Flat available near Talaimari"
                    className={inputClass}
                  />
                </label>

                <label className={labelClass}>
                  Property type *
                  <select
                    required
                    value={form.propertyType}
                    onChange={(e) => {
                      const propertyType = e.target.value;

                      setForm((current) => ({
                        ...current,
                        propertyType,
                        availableSeats:
                          propertyType === "flat"
                            ? ""
                            : current.availableSeats,
                        roomSharingType:
                          propertyType === "hostel"
                            ? current.roomSharingType
                            : "",
                      }));
                    }}
                    className={inputClass}
                  >
                    <option value="flat">Flat</option>
                    <option value="sublet">Sublet</option>
                    <option value="hostel">Hostel</option>
                  </select>
                </label>

                <label className={labelClass}>
                  Location *
                  <select
                    required
                    value={form.location}
                    onChange={(e) => updateForm("location", e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Choose an area</option>
                    {locations.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={labelClass}>
                  Monthly rent (৳) *
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={form.rent}
                    onChange={(e) => updateForm("rent", e.target.value)}
                    placeholder="e.g. 5000"
                    className={inputClass}
                  />
                </label>
              </div>

              <label className={labelClass}>
                Description (optional)
                <textarea
                  value={form.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                  minLength={10}
                  maxLength={3000}
                  rows={4}
                  placeholder="Describe the property, nearby facilities, rules, or anything else renters should know."
                  className={inputClass}
                />
                <span className="mt-1 block font-normal text-slate-500">
                  Leave blank if you prefer. If filled in, use 10–3,000
                  characters.
                </span>
              </label>

              <fieldset>
                <legend className="text-sm font-semibold">
                  Who can rent this property? *
                </legend>
                <p className="mt-1 text-sm text-slate-500">
                  Select one or both.
                </p>

                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.suitableFor.includes("bachelors")}
                      onChange={() => toggleTenant("bachelors")}
                      className="size-4 accent-blue-600"
                    />
                    Bachelor
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.suitableFor.includes("families")}
                      onChange={() => toggleTenant("families")}
                      className="size-4 accent-blue-600"
                    />
                    Family
                  </label>

                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={
                        form.suitableFor.includes("bachelors") &&
                        form.suitableFor.includes("families")
                      }
                      onChange={toggleBothTenants}
                      className="size-4 accent-blue-600"
                    />
                    Both
                  </label>
                </div>
              </fieldset>

              {form.suitableFor.includes("bachelors") && (
                <fieldset>
                  <legend className="text-sm font-semibold">
                    Gender preference for bachelors *
                  </legend>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
                    {[
                      { label: "Male", value: "male" },
                      { label: "Female", value: "female" },
                      { label: "Both", value: "any" },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="radio"
                          name="genderPreference"
                          value={option.value}
                          checked={form.gender === option.value}
                          onChange={() => updateForm("gender", option.value)}
                          className="size-4 accent-blue-600"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <label className={labelClass}>
                  Number of rooms (optional)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.roomCount}
                    onChange={(e) => updateForm("roomCount", e.target.value)}
                    placeholder="Number of rooms"
                    className={inputClass}
                  />
                </label>

                {(form.propertyType === "sublet" ||
                  form.propertyType === "hostel") && (
                  <label className={labelClass}>
                    Available seats (optional)
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.availableSeats}
                      onChange={(e) =>
                        updateForm("availableSeats", e.target.value)
                      }
                      placeholder="Number of available seats"
                      className={inputClass}
                    />
                  </label>
                )}
              </div>

              {form.propertyType === "hostel" && (
                <fieldset>
                  <legend className="text-sm font-semibold">
                    Hostel room type *
                  </legend>
                  <p className="mt-1 text-sm text-slate-500">
                    Single room accommodates one person; double room
                    accommodates two people sharing.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        required
                        type="radio"
                        name="roomSharingType"
                        value="single"
                        checked={form.roomSharingType === "single"}
                        onChange={() =>
                          updateForm("roomSharingType", "single")
                        }
                        className="size-4 accent-blue-600"
                      />
                      Single room (1 person)
                    </label>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        required
                        type="radio"
                        name="roomSharingType"
                        value="double"
                        checked={form.roomSharingType === "double"}
                        onChange={() =>
                          updateForm("roomSharingType", "double")
                        }
                        className="size-4 accent-blue-600"
                      />
                      Double room (2 people)
                    </label>
                  </div>
                </fieldset>
              )}

              <fieldset>
                <legend className="text-sm font-semibold">
                  Facilities available
                </legend>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
                  {facilityOptions.map((facility) => (
                    <label
                      key={facility.value}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={form.facilities.includes(facility.value)}
                        onChange={() => toggleFormFacility(facility.value)}
                        className="size-4 accent-blue-600"
                      />
                      {facility.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className={labelClass}>
                Contact phone number *
                <input
                  required
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{11}"
                  minLength={11}
                  maxLength={11}
                  value={form.phone}
                  onChange={(e) =>
                    updateForm(
                      "phone",
                      e.target.value.replace(/\D/g, "").slice(0, 11)
                    )
                  }
                  placeholder="11-digit phone number"
                  className={inputClass}
                />
              </label>

              <div>
                <label className={labelClass}>
                  Property photos * (1–5 photos)
                  <input
                    required
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleImageChange}
                    className="mt-2 block w-full rounded-lg border border-slate-300 p-3 text-sm font-normal file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700"
                  />
                </label>

                <p className="mt-2 text-sm text-slate-500">
                  JPEG, PNG, or WebP. Maximum 5 MB per photo.
                </p>

                {selectedImages.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-slate-600">
                    {selectedImages.map((image, index) => (
                      <li key={`${image.name}-${index}`}>
                        {index + 1}. {image.name} (
                        {(image.size / (1024 * 1024)).toFixed(2)} MB)
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-5">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Publish listing"}
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setShowSubmissionForm(false);
                    setSubmissionError("");
                    setSubmissionSuccess("");
                  }}
                  className="rounded-lg border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Listings are submitted to our server for validation before
                publication. Please ensure your property information is
                accurate.
              </p>
            </form>
          )}
        </div>
      </section>

      <footer className="border-t px-5 py-6 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Fatin Arnob
      </footer>

      {/* PROPERTY DETAILS MODAL */}
      {selectedProperty && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 md:p-6"
          onClick={() => setSelectedProperty(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="property-detail-title"
            className="relative flex h-full w-full flex-col overflow-hidden bg-white md:h-auto md:max-h-[92vh] md:max-w-5xl md:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex shrink-0 items-center justify-between gap-4 border-b px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  {selectedProperty.type}
                </p>
                <h2
                  id="property-detail-title"
                  className="truncate text-lg font-bold text-slate-900"
                >
                  {selectedProperty.title}
                </h2>
              </div>

              <button
                type="button"
                autoFocus
                onClick={() => setSelectedProperty(null)}
                aria-label="Close property details"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-2xl text-slate-700 hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            {/* Scrollable modal body */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {/* Photo gallery */}
              <div className="grid grid-cols-1 gap-2 bg-slate-100 p-2 sm:grid-cols-2">
                {selectedProperty.images.map((photo, index) => (
                  <img
                    key={`${photo}-${index}`}
                    src={photo}
                    alt={`${selectedProperty.title} — photo ${index + 1}`}
                    className={`w-full object-cover ${
                      index === 0
                        ? "h-64 sm:col-span-2 sm:h-96"
                        : "h-48 sm:h-56"
                    }`}
                  />
                ))}
              </div>

              <div className="space-y-7 p-5 sm:p-8">
                {/* Rent and location */}
                <div>
                  <p className="text-3xl font-bold text-blue-600">
                    ৳{Number(selectedProperty.rent).toLocaleString("en-BD")}
                    <span className="text-sm font-normal text-slate-500">
                      {" "}/ month
                    </span>
                  </p>

                  <p className="mt-3 flex items-start gap-2 text-slate-600">
                    <span aria-hidden="true">📍</span>
                    {selectedProperty.location}, Rajshahi
                  </p>
                </div>

                {/* Description */}
                <div>
                  <h3 className="text-lg font-bold">About this property</h3>
                  <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-600">
                    {selectedProperty.description ||
                      "No description provided by the owner."}
                  </p>
                </div>

                {/* Full property details */}
                <div>
                  <h3 className="text-lg font-bold">Property details</h3>

                  <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <dt className="text-sm text-slate-500">
                        Property type
                      </dt>
                      <dd className="mt-1 font-semibold">
                        {selectedProperty.type}
                      </dd>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <dt className="text-sm text-slate-500">Suitable for</dt>
                      <dd className="mt-1 font-semibold">
                        {selectedProperty.suitableFor.length
                          ? selectedProperty.suitableFor.join(", ")
                          : "Not specified"}
                      </dd>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <dt className="text-sm text-slate-500">
                        Gender preference
                      </dt>
                      <dd className="mt-1 font-semibold">
                        {selectedProperty.suitableFor.includes("Bachelor")
                          ? selectedProperty.gender === "male"
                            ? "Male"
                            : selectedProperty.gender === "female"
                              ? "Female"
                              : "Any gender"
                          : "Not applicable"}
                      </dd>
                    </div>

                    {selectedProperty.roomCount != null && (
                      <div className="rounded-xl bg-slate-50 p-4">
                        <dt className="text-sm text-slate-500">
                          Number of rooms
                        </dt>
                        <dd className="mt-1 font-semibold">
                          {selectedProperty.roomCount}
                        </dd>
                      </div>
                    )}

                    {selectedProperty.availableSeats != null && (
                      <div className="rounded-xl bg-slate-50 p-4">
                        <dt className="text-sm text-slate-500">
                          Available seats
                        </dt>
                        <dd className="mt-1 font-semibold">
                          {selectedProperty.availableSeats}
                        </dd>
                      </div>
                    )}

                    {selectedProperty.type === "Hostel" &&
                      selectedProperty.roomSharingType && (
                        <div className="rounded-xl bg-slate-50 p-4">
                          <dt className="text-sm text-slate-500">
                            Hostel room type
                          </dt>
                          <dd className="mt-1 font-semibold">
                            {selectedProperty.roomSharingType === "single"
                              ? "Single room (1 person)"
                              : selectedProperty.roomSharingType === "double"
                                ? "Double room (2 people)"
                                : selectedProperty.roomSharingType}
                          </dd>
                        </div>
                      )}
                  </dl>
                </div>

                {/* Facilities */}
                <div>
                  <h3 className="text-lg font-bold">Facilities</h3>

                  {selectedProperty.facilities.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedProperty.facilities.map((facility) => (
                        <span
                          key={facility}
                          className="rounded-full bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800"
                        >
                          ✓ {facility}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">
                      No facilities listed.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Persistent contact area */}
            <div className="shrink-0 border-t bg-white p-4 sm:px-6">
              {selectedProperty.phone ? (
                <a
                  href={`tel:${selectedProperty.phone}`}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700"
                >
                  <span aria-hidden="true">☎</span>
                  Call owner · {selectedProperty.phone}
                </a>
              ) : (
                <p className="rounded-xl bg-slate-100 p-3 text-center text-sm text-slate-600">
                  Owner's phone number is unavailable.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
