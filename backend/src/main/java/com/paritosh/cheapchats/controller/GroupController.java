package com.paritosh.cheapchats.controller;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.time.LocalDateTime;

import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.paritosh.cheapchats.models.ChatGroup;
import com.paritosh.cheapchats.models.User;
import com.paritosh.cheapchats.dto.ChatMessageDto;
import com.paritosh.cheapchats.repositories.ChatGroupRepository;
import com.paritosh.cheapchats.repositories.UserRepository;
import com.paritosh.cheapchats.services.GroupService;

import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/api")
@Slf4j
public class GroupController {

    @Autowired
    private GroupService groupService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ChatGroupRepository chatGroupRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    // LOGIN
    @PostMapping("/login")
    public Map<String, String> login(@RequestParam String username) {

        // Check if the user already exists
        // If not, create a new user with a unique session ID
        if (!userRepository.existsById(username)) {

            User user = new User();

            // Generate a unique session ID for the user
            // This session ID can be used to identify the user in the chat system
            user.setUserName(username);
            user.setSessionId(UUID.randomUUID().toString());

            // save changes
            userRepository.save(user);

        }

        // log user login
        log.info("LOGIN: User: {}", username);

        // If the user already exists, return the user
        return Map.of("status", "ok", "username", username);

    }

    // CREATE GROUP
    @PostMapping("/group")
    public ChatGroup createGroup(
            @RequestParam String groupName,
            @RequestParam String createdBy,
            @RequestParam(defaultValue = "60") int expiryInMinutes
    ) throws Exception {
        return groupService.createChatGroup(groupName, createdBy, expiryInMinutes);
    }

    // Exception handler for IllegalArgumentException
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {
        if (ex.getMessage() != null && ex.getMessage().contains("already exists")) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Group with this name already exists."));
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", ex.getMessage()));
    }

    // GET GROUP
    @GetMapping("/group/{groupName}")
    public ChatGroup getGroup(@PathVariable String groupName) {
        return groupService.getGroupByName(groupName);
    }

    // GET GROUP EXPIRY TIME
    @GetMapping("/group/{groupName}/expiresIn")
    public ResponseEntity<Map<String, Object>> getGroupExpiryIn(@PathVariable String groupName) {
        try {
            ChatGroup group = groupService.getGroupByName(groupName);
            if (group == null) {
                return ResponseEntity.notFound().build();
            }
            double minsLeft = groupService.getMinutesUntilExpiry(groupName);
            boolean isExpired = group.isExpired() || minsLeft <= 0;

            return ResponseEntity.ok(Map.of(
                    "minsLeft", minsLeft,
                    "createdAtEpochMillis", groupService.getCreatedAtEpochMillis(groupName),
                    "expiryDurationMinutes", groupService.getExpiryDurationMinutes(groupName),
                    "expiresAtEpochMillis", groupService.getExpiryAtEpochMillis(groupName),
                    "isExpired", isExpired
            ));
        } catch (IllegalStateException e) {
            log.error("Error getting group expiry time for {}: {}", groupName, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // JOIN GROUP
    @PostMapping("/group/{groupName}/join")
    public ResponseEntity<ChatGroup> joinGroup(
            @PathVariable String groupName,
            @RequestParam String username
    ) {

        if (groupName == null) {
            return ResponseEntity.badRequest().build();
        }
        ChatGroup existingGroup = groupService.getGroupByName(groupName);
        boolean wasMember = existingGroup != null && existingGroup.getMembers().contains(username);
        return groupService.joinChatGroup(groupName, username)
                .map(group -> {
                    if (!wasMember) {
                        messagingTemplate.convertAndSend(
                                "/topic/group/" + groupName,
                                createGroupEvent("JOIN", username, username + " joined the group", groupName));
                    }
                    return ResponseEntity.ok(group);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());

    }

    // LEAVE GROUP
    @PostMapping("/group/{groupName}/leave")
    public Map<String, String> leaveGroup(
            @PathVariable String groupName,
            @RequestParam String username
    ) {

        boolean success = groupService.leaveChatGroup(groupName, username);
        if (success) {
            messagingTemplate.convertAndSend(
                    "/topic/group/" + groupName,
                    createGroupEvent("LEAVE", username, username + " left the group", groupName));
        }

        return Map.of("left", String.valueOf(success));

    }

    // Check for existing group name
    @GetMapping("/group/{groupName}/checkName")
    public ResponseEntity<Map<String, Boolean>> checkGroupNameExists(@PathVariable String groupName) {

        boolean exists = chatGroupRepository.existsByGroupName(groupName);

        return ResponseEntity.ok(Map.of("exists", exists));

    }

    // List all groups for a user (not expired)
    @GetMapping("/groups")
    public List<ChatGroup> getUserGroups(@RequestParam String username) {

        List<ChatGroup> allGroups = groupService.getGroupsForUser(username);
        return allGroups;

    }

    // UPDATE GROUP SETTINGS
    @PutMapping("/group/{groupName}/settings")
    public Map<String, Object> updateGroupInfo(
            @PathVariable String groupName,
            @RequestBody String jsonBody,
            @RequestParam(required = false) String username) throws Exception {

        log.info("inside controller updateGroupInfo");

        JSONObject groupSettingsJson = new JSONObject(jsonBody);

        String newGroupName = groupSettingsJson.optString("newGroupName", "");
        Integer newExpiryMinutes = groupSettingsJson.has("newExpiryMinutes")
                && !groupSettingsJson.isNull("newExpiryMinutes")
                ? groupSettingsJson.getInt("newExpiryMinutes")
                : null;
        boolean success = groupService.updateGroupInfo(
                groupName.trim(), newGroupName, newExpiryMinutes);

        if (!success) {
            return Map.of("updated", false);
        }

        String updatedGroupName = newGroupName == null || newGroupName.isBlank()
                ? groupName.trim()
                : newGroupName.trim();
        long expiresAt = groupService.getExpiryAtEpochMillis(updatedGroupName);
        ChatMessageDto updateEvent = createGroupEvent(
                "GROUP_UPDATED",
                username == null ? "" : username,
                "Group settings were updated",
                updatedGroupName);
        updateEvent.setExpiresAtEpochMillis(expiresAt);
        messagingTemplate.convertAndSend("/topic/group/" + groupName.trim(), updateEvent);
        if (!updatedGroupName.equals(groupName.trim())) {
            messagingTemplate.convertAndSend("/topic/group/" + updatedGroupName, updateEvent);
        }

        return Map.of("updated", true, "groupName", updatedGroupName, "expiresAtEpochMillis", expiresAt);
    }

    // REMOVE MEMBER
    @DeleteMapping("/group/{groupName}/remove")
    public ResponseEntity<?> removeMember(
            @PathVariable String groupName,
            @RequestParam String targetMember
    ) {

        LocalDateTime removedAt = groupService.removeMember(groupName, targetMember);
        if (removedAt != null) {
            ChatMessageDto kickEvent = createGroupEvent(
                    "KICKED_OUT", targetMember, targetMember + " was removed from the group", groupName);
            kickEvent.setTimestamp(removedAt.toString());
            messagingTemplate.convertAndSend("/topic/group/" + groupName, kickEvent);
        }

        return ResponseEntity.ok(Map.of("removed", true));

    }

    // Delete a group (admin only)
    @DeleteMapping("/group/{groupName}")
    public ResponseEntity<?> deleteGroup(@PathVariable String groupName, @RequestParam String username) {

        log.info("inside controller deleteGroup");

        ChatGroup group = groupService.getGroupByName(groupName);

        if (group == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Group not found"));
        }

        boolean expired = group.isExpired() || groupService.getMinutesUntilExpiry(groupName) <= 0;
        boolean isAdmin = username != null && group.getCreatedBy().equals(username);

        if (!expired && !isAdmin) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Only admin can delete the group"));
        }

        groupService.deleteGroup(groupName);
        messagingTemplate.convertAndSend(
                "/topic/group/" + groupName,
                createGroupEvent(
                        expired ? "GROUP_EXPIRED" : "GROUP_DELETED",
                        username == null ? "" : username,
                        expired ? "This group has expired" : "This group was deleted",
                        groupName)
        );

        return ResponseEntity.ok(Map.of("deleted", true));
    }

    private ChatMessageDto createGroupEvent(String type, String sender, String content, String groupName) {
        ChatMessageDto event = new ChatMessageDto();
        event.setType(type);
        event.setSender(sender);
        event.setContent(content);
        event.setTimestamp(LocalDateTime.now().toString());
        event.setGroupName(groupName);
        return event;
    }

}
