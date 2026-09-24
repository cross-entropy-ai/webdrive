import { Icon as IconifyIcon, type IconProps } from "@iconify/react";
import addFolderLinear from "@iconify-icons/solar/add-folder-linear";
import altArrowLeftLinear from "@iconify-icons/solar/alt-arrow-left-linear";
import altArrowRightLinear from "@iconify-icons/solar/alt-arrow-right-linear";
import arrowLeftLinear from "@iconify-icons/solar/arrow-left-linear";
import checkCircleBold from "@iconify-icons/solar/check-circle-bold";
import checkSquareLinear from "@iconify-icons/solar/check-square-linear";
import closeCircleLinear from "@iconify-icons/solar/close-circle-linear";
import documentTextLinear from "@iconify-icons/solar/document-text-linear";
import downloadSquareLinear from "@iconify-icons/solar/download-square-linear";
import folderBoldDuotone from "@iconify-icons/solar/folder-bold-duotone";
import folderLinear from "@iconify-icons/solar/folder-linear";
import folderPathConnectLinear from "@iconify-icons/solar/folder-path-connect-linear";
import galleryLinear from "@iconify-icons/solar/gallery-linear";
import homeLinear from "@iconify-icons/solar/home-linear";
import listLinear from "@iconify-icons/solar/list-linear";
import maximizeLinear from "@iconify-icons/solar/maximize-linear";
import menuDotsBold from "@iconify-icons/solar/menu-dots-bold";
import moonLinear from "@iconify-icons/solar/moon-linear";
import musicNoteLinear from "@iconify-icons/solar/music-note-linear";
import penLinear from "@iconify-icons/solar/pen-linear";
import playBold from "@iconify-icons/solar/play-bold";
import sunLinear from "@iconify-icons/solar/sun-linear";
import trashBin2Linear from "@iconify-icons/solar/trash-bin-2-linear";
import uploadSquareLinear from "@iconify-icons/solar/upload-square-linear";
import videocameraLinear from "@iconify-icons/solar/videocamera-linear";
import widgetLinear from "@iconify-icons/solar/widget-linear";

import searchLinear from "@iconify-icons/solar/minimalistic-magnifer-linear";
import refreshLinear from "@iconify-icons/solar/refresh-linear";

import archiveLinear from "@iconify-icons/solar/archive-linear";

const icons: Record<string, IconProps["icon"]> = {
	"solar:archive-linear": archiveLinear,
	"solar:minimalistic-magnifer-linear": searchLinear,
	"solar:refresh-linear": refreshLinear,
	"solar:add-folder-linear": addFolderLinear,
	"solar:alt-arrow-left-linear": altArrowLeftLinear,
	"solar:alt-arrow-right-linear": altArrowRightLinear,
	"solar:arrow-left-linear": arrowLeftLinear,
	"solar:check-circle-bold": checkCircleBold,
	"solar:check-square-linear": checkSquareLinear,
	"solar:close-circle-linear": closeCircleLinear,
	"solar:document-text-linear": documentTextLinear,
	"solar:download-square-linear": downloadSquareLinear,
	"solar:folder-bold-duotone": folderBoldDuotone,
	"solar:folder-linear": folderLinear,
	"solar:folder-path-connect-linear": folderPathConnectLinear,
	"solar:gallery-linear": galleryLinear,
	"solar:home-linear": homeLinear,
	"solar:list-linear": listLinear,
	"solar:maximize-linear": maximizeLinear,
	"solar:menu-dots-bold": menuDotsBold,
	"solar:moon-linear": moonLinear,
	"solar:music-note-linear": musicNoteLinear,
	"solar:pen-linear": penLinear,
	"solar:play-bold": playBold,
	"solar:sun-linear": sunLinear,
	"solar:trash-bin-2-linear": trashBin2Linear,
	"solar:upload-square-linear": uploadSquareLinear,
	"solar:videocamera-linear": videocameraLinear,
	"solar:widget-linear": widgetLinear,
};

// Bundle the used icons so rendering never waits for the Iconify API.
export function Icon({ icon, ...props }: IconProps) {
	return (
		<IconifyIcon
			{...props}
			icon={
				typeof icon === "string"
					? (icons[icon] ?? icons["solar:document-text-linear"]!)
					: icon
			}
		/>
	);
}
