import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { compareTime } from "@/lib/utils";
import DatePicker from "@/components/ui/date-picker";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import deepcopy from "deepcopy";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";

export default function AddSlots({ slots, setSlots }) {
  const timeRegex = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  const timeSchema = z
    .string()
    .regex(timeRegex, { message: "Please enter a valid time" });

  const schema = z
    .object({
      title: z.string().min(1, "Title is required"),
      description: z.string(),
      date: z.union([z.date().nullable(), z.literal("default")]),
      isDefault: z.boolean().optional(),
      startTime: timeSchema,
      endTime: timeSchema,
      breakStartTime: timeSchema,
      breakEndTime: timeSchema,
      slotDuration: z.string(),
    })
    .refine(
      (data) => {
        return (
          compareTime(data.startTime, "isBefore", data.endTime) ||
          compareTime(data.startTime, "isSame", data.endTime)
        );
      },
      {
        message: "End time must be on or after start time.",
        path: ["endTime"],
      }
    )
    .refine(
      (data) => {
        return (
          compareTime(data.breakStartTime, "isBefore", data.breakEndTime) ||
          compareTime(data.breakStartTime, "isSame", data.breakEndTime)
        );
      },
      {
        message: "Break end time must be on or after break start time.",
        path: ["breakEndTime"],
      }
    )
    .refine(
      (data) => {
        return (
          (compareTime(data.startTime, "isBefore", data.breakStartTime) ||
            compareTime(data.startTime, "isSame", data.breakStartTime)) &&
          (compareTime(data.breakStartTime, "isBefore", data.endTime) ||
            compareTime(data.breakStartTime, "isSame", data.endTime))
        );
      },
      {
        message: "Break start time must be between start time and end time.",
        path: ["breakStartTime"],
      }
    )
    .refine(
      (data) => {
        return (
          (compareTime(data.startTime, "isBefore", data.breakEndTime) ||
            compareTime(data.startTime, "isSame", data.breakEndTime)) &&
          (compareTime(data.breakEndTime, "isBefore", data.endTime) ||
            compareTime(data.breakEndTime, "isSame", data.endTime))
        );
      },
      {
        message: "Break end time must be between start time and end time.",
        path: ["breakEndTime"],
      }
    )
    .refine(
      (data) => {
        return Number.isInteger(Number(data.slotDuration));
      },
      {
        message: "Slot duration must be an integer",
        path: ["slotDuration"],
      }
    )
    .refine(
      (data) => {
        return Number(data.slotDuration) > 0;
      },
      {
        message: "Slot duration must be greater than 0",
        path: ["slotDuration"],
      }
    )
    .refine(
      (data) => {
        return data.date !== null || data.isDefault;
      },
      {
        message: "Either select a slot date or make it as default slot value",
        path: ["slotDateError"],
      }
    );

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "Timetable",
      description: "",
      date: new Date(),
      isDefault: true,
      startTime: "09:00",
      endTime: "18:30",
      breakStartTime: "13:00",
      breakEndTime: "13:45",
      slotDuration: "60",
    },
  });

  const watchIsDefault = form.watch("isDefault");

  const getAllSlots = (data) => {
    /**
     * deepcopy slots
     * generate new slots based on current form data
     * push to slots copy or replace default slots and then setSlots
     */

    // helper functions
    const getTimeNumsFromString = (time: string) =>
      time.split(":").map((t) => Number(t));
    const getTimeStringFromNums = (hour: number, minute: number) => {
      const hh = hour.toString().padStart(2, "0");
      const mm = minute.toString().padStart(2, "0");
      return `${hh}:${mm}`;
    };
    const addMinutes = (hour: number, minute: number, minutes: number) => {
      const totalMinutes = hour * 60 + minute + minutes;
      const newHour = Math.floor(totalMinutes / 60);
      const newMinute = totalMinutes % 60;
      return [newHour, newMinute];
    };

    // form values
    const [startHour, startMinute] = getTimeNumsFromString(data.startTime);
    const [endHour, endMinute] = getTimeNumsFromString(data.endTime);
    const [breakStartHour, breakStartMinute] = getTimeNumsFromString(
      data.breakStartTime
    );
    const [breakEndHour, breakEndMinute] = getTimeNumsFromString(
      data.breakEndTime
    );
    const beforeBreakMinutes =
      (breakStartHour - startHour) * 60 + breakStartMinute - startMinute;
    const afterBreakMinutes =
      (endHour - breakEndHour) * 60 + endMinute - breakEndMinute;
    const slotMinutes = parseInt(data.slotDuration);
    const numSlotsBeforeBreak = Math.floor(beforeBreakMinutes / slotMinutes);
    const numSlotsAfterBreak = Math.floor(afterBreakMinutes / slotMinutes);

    const generateNewSlots = () => {
      const newSlots = [];

      // generate slots before break
      for (let i = 0; i < numSlotsBeforeBreak; i++) {
        const [slotStartHour, slotStartMinute] = addMinutes(
          startHour,
          startMinute,
          i * slotMinutes
        );
        const [slotEndHour, slotEndMinute] = addMinutes(
          startHour,
          startMinute,
          (i + 1) * slotMinutes
        );

        const slotStartTime = getTimeStringFromNums(
          slotStartHour,
          slotStartMinute
        );
        const slotEndTime = getTimeStringFromNums(slotEndHour, slotEndMinute);
        newSlots.push({
          id: uuidv4(),
          title: `Slot ${i + 1}`,
          description: "",
          start: slotStartTime,
          end: slotEndTime,
          type: "slot",
        });
      }

      // add buffer if last slot ends before break
      if (newSlots[newSlots.length - 1].end !== data.breakStartTime) {
        newSlots.push({
          id: uuidv4(),
          title: `Buffer`,
          description: "",
          start: newSlots[newSlots.length - 1].end,
          end: data.breakStartTime,
          type: "buffer",
        });
      }

      // generate break
      newSlots.push({
        id: uuidv4(),
        title: "Break",
        description: "",
        start: data.breakStartTime,
        end: data.breakEndTime,
        type: "break",
      });

      // generate slots after break
      for (let i = 0; i < numSlotsAfterBreak; i++) {
        const [slotStartHour, slotStartMinute] = addMinutes(
          breakEndHour,
          breakEndMinute,
          i * slotMinutes
        );
        const [slotEndHour, slotEndMinute] = addMinutes(
          breakEndHour,
          breakEndMinute,
          (i + 1) * slotMinutes
        );

        const slotStartTime = getTimeStringFromNums(
          slotStartHour,
          slotStartMinute
        );
        const slotEndTime = getTimeStringFromNums(slotEndHour, slotEndMinute);
        newSlots.push({
          id: uuidv4(),
          title: `Slot ${numSlotsBeforeBreak + i + 1}`,
          description: "",
          start: slotStartTime,
          end: slotEndTime,
          type: "slot",
        });
      }

      // add buffer if last slot ends before day end
      if (newSlots[newSlots.length - 1].end !== data.endTime) {
        newSlots.push({
          id: uuidv4(),
          title: `Buffer`,
          description: "",
          start: newSlots[newSlots.length - 1].end,
          end: data.endTime,
          type: "buffer",
        });
      }
      return newSlots;
    };

    const newSlots = generateNewSlots();

    let updatedNewSlots;
    if (watchIsDefault) {
      updatedNewSlots = newSlots.map((slot) => {
        return {
          ...slot,
          date: "default",
        };
      });
    } else {
      updatedNewSlots = newSlots.map((slot) => {
        return {
          ...slot,
          date: format(data.date, "yyyy-MM-dd"),
        };
      });
    }

    const currentSlots = deepcopy(slots);

    if (currentSlots === null) {
      setSlots(updatedNewSlots);
      return;
    }

    // find all events (slots) that are on the given day, and then replace them with new events (slots)
    let cleanCurrentSlots;
    if (watchIsDefault) {
      cleanCurrentSlots = currentSlots.filter(
        (slot) => slot.date !== "default"
      );
    } else {
      cleanCurrentSlots = currentSlots.filter(
        (slot) => slot.date !== format(data.date, "yyyy-MM-dd")
      );
    }
    setSlots([...cleanCurrentSlots, ...updatedNewSlots]);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(getAllSlots)}
        className="p-4 flex items-center justify-center"
      >
        <div className="flex flex-col items-center justify-center gap-8">
          <div className="flex gap-8">
            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem className="w-50">
                  <FormLabel>Start Time</FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      {...field}
                      className="flex items-center justify-center"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endTime"
              render={({ field }) => (
                <FormItem className="w-50">
                  <FormLabel>End Time</FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      {...field}
                      className="flex items-center justify-center"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="flex gap-8">
            <FormField
              control={form.control}
              name="breakStartTime"
              render={({ field }) => (
                <FormItem className="w-50">
                  <FormLabel>Break Start Time</FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      {...field}
                      className="flex items-center justify-center"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="breakEndTime"
              render={({ field }) => (
                <FormItem className="w-50">
                  <FormLabel>Break End Time</FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      {...field}
                      className="flex items-center justify-center"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="flex gap-8">
            <FormField
              control={form.control}
              name="slotDuration"
              render={({ field }) => (
                <FormItem className="w-50">
                  <FormLabel>
                    Duration per Slot
                    <span className="font-normal">(in minutes)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      className="flex items-center justify-center"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="w-50">
                  <FormLabel
                    className={watchIsDefault ? "text-muted-foreground" : ""}
                  >
                    Date
                  </FormLabel>
                  <FormControl>
                    <DatePicker
                      value={
                        !form.getValues("isDefault") ? field.value : undefined
                      }
                      onChange={field.onChange}
                      disabled={watchIsDefault}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="isDefault"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormControl>
                  <div className="flex gap-2 items-center">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      id="set-default-slot-values"
                    />
                    <Label
                      className="font-normal"
                      htmlFor="set-default-slot-values"
                    >
                      Set as default slots for all dates
                    </Label>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.formState.errors.slotDateError && (
            <p className="text-red-500">
              {form.formState.errors.slotDateError.message}
            </p>
          )}
          <Button type="submit">Generate Slots</Button>
        </div>
      </form>
    </Form>
  );
}
